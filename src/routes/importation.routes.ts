import { Router } from "express";
import {
  getImportations,
  getImportationById,
  createImportation,
  updateImportation,
  verifyImportation,
} from "../controllers/importation.controller";

const router = Router();

router.get("/get-importations", getImportations);
router.get("/get-importation/:id", getImportationById);
router.post("/create-importation", createImportation);
router.put("/update-importation/:id", updateImportation);
router.patch("/verify-importation/:id", verifyImportation);

export default router;
