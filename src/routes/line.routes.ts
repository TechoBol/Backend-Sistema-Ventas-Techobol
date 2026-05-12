import { Router } from "express";
import {
  getLines,
  createLines,
  deleteLines,
  updateLine,
} from "../controllers/line.controller";

const router = Router();

// Lines
router.get("/get-lines", getLines);
router.post("/create-line", createLines);
router.put("/update-line/:id", updateLine);
router.delete("/delete-line/:id", deleteLines);

export default router;