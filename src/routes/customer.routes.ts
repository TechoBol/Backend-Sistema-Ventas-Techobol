import { Router } from "express";
import {
  listCustomers,
  findCustomerById,
  editCustomer,
  removeCustomer,
  storeAddress,
  removeAddress,
  storeNit,
  storeNote,
  removeNote,
} from "../controllers/customer.controller";

const router = Router();

// CRUD base
router.get("/", listCustomers);
router.get("/:id", findCustomerById);
router.put("/:id", editCustomer);
router.delete("/:id", removeCustomer);

// Direcciones
router.post("/:id/addresses", storeAddress);
router.delete("/:id/addresses/:addressId", removeAddress);

// NITs
router.post("/:id/nits", storeNit);

// Notas
router.post("/:id/notes", storeNote);
router.delete("/:id/notes/:noteId", removeNote);

export default router;