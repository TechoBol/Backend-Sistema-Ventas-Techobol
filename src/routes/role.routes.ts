import { Router } from "express";
import {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
} from "../controllers/role.controller";

const router = Router();

router.get("/get-roles", getRoles);
router.post("/create-role", createRole);
router.put("/update-role/:id", updateRole);
router.delete("/delete-role/:id", deleteRole);

export default router;