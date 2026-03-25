import "dotenv/config";
import express from "express";
import { initDb } from "./db";
import { contactsRouter } from "./routes/contacts";
import { templatesRouter } from "./routes/templates";
import { campaignsRouter } from "./routes/campaigns";
import { startCronScheduler } from "./campaigns/scheduler";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.use("/contacts",  contactsRouter);
app.use("/templates", templatesRouter);
app.use("/campaigns", campaignsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err: Error, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong", message: err.message });
});

initDb().then(() => {
  startCronScheduler();
  app.listen(PORT, () => {
    console.log(`\n✅ Server running at http://localhost:${PORT}`);
    console.log(`   Open HOW_TO_TEST.md for step-by-step testing instructions\n`);
  });
}).catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
