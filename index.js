import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";
import cors from "cors";
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

const client = new MongoClient(process.env.MONGO_URL);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const mongoClient = await connectToMongoDB();
const db = mongoClient.db("book_nook");
const booksCollection = db.collection("books");
const borrowsCollection = db.collection("borrows");

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  const JWKS = createRemoteJWKSet(
    new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
  );

  try {
    const { payload } = await jwtVerify(token, JWKS);
    next();
  } catch (error) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
};

app.post("/add-book", verifyToken, async (req, res) => {
  const data = req.body;
  const result = await booksCollection.insertOne(data);
  res.send(result);
});

app.get("/all-books", async (req, res) => {
  const result = await booksCollection.find({}).toArray();
  res.send(result);
});

app.get("/new-arrivals", async (req, res) => {
  const result = await booksCollection
    .find()
    .sort({ addedDate: -1 })
    .limit(6)
    .toArray();

  res.send(result);
});

app.get("/book/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const result = await booksCollection.findOne({ _id: new ObjectId(id) });
  res.send(result);
});

// Borrow a book
app.post("/borrow-book", async (req, res) => {
  try {
    const data = req.body;

    if (!data.bookId || !data.bookTitle || !data.userEmail) {
      return res.status(400).send({ message: "Missing borrow information." });
    }

    const existingBorrow = await borrowsCollection.findOne({
      bookId: data.bookId,
      userEmail: data.userEmail,
      status: "borrowed",
    });

    if (existingBorrow) {
      return res.status(409).send({
        message: "You have already borrowed this book.",
      });
    }

    const borrowDate = new Date();
    const returnDate = new Date(borrowDate);
    returnDate.setDate(returnDate.getDate() + 14);

    const borrowData = {
      bookId: data.bookId,
      bookTitle: data.bookTitle,
      bookImage: data.bookImage,
      userEmail: data.userEmail,
      borrowDate,
      returnDate,
      status: "borrowed",
    };

    const result = await borrowsCollection.insertOne(borrowData);

    res.status(201).send({
      message: "Book borrowed successfully.",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to borrow book." });
  }
});

// Get logged-in user's borrowed books
app.get("/my-borrows/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const result = await borrowsCollection
      .find({ userEmail: email })
      .sort({ borrowDate: -1 })
      .toArray();

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch borrowed books." });
  }
});

// Return a book
app.patch("/return-book/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid borrow ID." });
    }

    const result = await borrowsCollection.updateOne(
      { _id: new ObjectId(id), status: "borrowed" },
      {
        $set: {
          status: "returned",
          returnedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: "Borrow record not found." });
    }

    res.send({ message: "Book returned successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to return book." });
  }
});

// my-books
app.get("/my-books/:email", verifyToken, async (req, res) => {
  try {
    const { email } = req.params;

    const result = await booksCollection
      .find({ email })
      .sort({ addedDate: -1 })
      .toArray();

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch your books." });
  }
});

// PATCH: Update a book
app.patch("/book/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { email, ...updatedData } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid book ID." });
    }

    if (!email) {
      return res.status(400).send({ message: "Email is required." });
    }

    const result = await booksCollection.updateOne(
      { _id: new ObjectId(id), email },
      { $set: updatedData },
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: "Book not found." });
    }

    res.send({ message: "Book updated successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to update book." });
  }
});

// DELETE: Delete a book
app.delete("/book/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid book ID." });
    }

    if (!email) {
      return res.status(400).send({ message: "Email is required." });
    }

    const result = await booksCollection.deleteOne({
      _id: new ObjectId(id),
      email,
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({ message: "Book not found." });
    }

    res.send({ message: "Book deleted successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to delete book." });
  }
});

app.get("/", (req, res) => {
  res.send({ message: "Server is running" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;