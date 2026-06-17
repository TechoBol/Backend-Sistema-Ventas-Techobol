import { Router } from "express";
import {
  createProduct,
  getKardex,
  getKardexPro,
  getProducts,
  getStockByBranches,
  getValuedInventory,
  updateMargenProduct,
  updateProduct,
} from "../controllers/product.controller";

const router = Router();

router.post("/create-product", createProduct);
router.get("/get-products", getProducts);
router.put("/update-product/:id", updateProduct);
router.post("/kardex", getKardex);
router.post("/kardex-pro", getKardexPro);
router.put("/update-margen/:id", updateMargenProduct);
router.get("/stock-branches/:productId", getStockByBranches);
router.post("/kardex-valorado", getValuedInventory);

export default router;
