import transporter from "../services/nodemailer";
import { transferEmailTemplate } from "./transferEmailTemplate";

interface Product {
  code: string;
  name: string;
  quantity: number;
}

interface Props {
  email: string;
  employee: string;
  transferCode: string;
  origin: string;
  destination: string;
  editedBy: string;
  reason?: string | null;
  products: Product[];
}

export const sendTransferEditedNotification = async ({
  email,
  employee,
  transferCode,
  origin,
  destination,
  editedBy,
  reason,
  products,
}: Props) => {

  await transporter.sendMail({
    from: process.env.USER_EMAIL,
    to: email,
    subject: `Transferencia ${transferCode} modificada`,
    html: transferEmailTemplate({
      title: "Transferencia Modificada",
      status: "MODIFICADA",
      statusColor: "#f59e0b",
      employee,
      transferCode,
      origin,
      destination,
      actionByLabel: "Modificado por",
      actionBy: editedBy,
      reason,
      message: `
        La transferencia <b>${transferCode}</b> fue
        <b style="color:#f59e0b;">MODIFICADA</b>.
      `,
      products,
    })
  });
};