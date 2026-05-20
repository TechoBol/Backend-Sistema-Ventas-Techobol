import { Router } from 'express'
import { approveTransfer, createTransfer, getMyTransfers, rejectTransfer } from '../controllers/transfer.controller';

const router = Router()

router.post("/create-transfer", createTransfer);
router.get("/my-transfers", getMyTransfers);
router.put("/transfer-approve/:id", approveTransfer);
router.put("/transfer-reject/:id", rejectTransfer);
export default router