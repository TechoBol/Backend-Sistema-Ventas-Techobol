import { Router } from "express";
import {
  createQuotation,
  getQuotations,
  updateQuotationStatus,
  convertQuotationToSale,
  getQuotationsByCustomer,
} from "../controllers/quotation.controller";

const router = Router();

router.post("/create-quotation", createQuotation);
router.get("/get-quotations", getQuotations);
router.patch("/:id/status", updateQuotationStatus);
router.post("/:id/convert", convertQuotationToSale);
router.get("/customer/:customerId", getQuotationsByCustomer);

export default router;