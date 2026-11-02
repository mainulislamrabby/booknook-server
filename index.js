import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";
import cors from "cors";

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

app.post("/add-book", async (req, res) => {
  const data = req.body;
  const result = await booksCollection.insertOne(data);
  res.send(result);
});

app.get("/all-books", async (req, res) => {
    const result = await booksCollection.find({}).toArray();
    res.send(result);
});

app.get("/book/:id", async (req, res) => {
  const {id} = req.params;
  const result = await booksCollection.findOne({ _id: new ObjectId(id) });
  res.send(result);
});

app.get("/", (req, res) => {
  res.send({ message: "Server is running" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
