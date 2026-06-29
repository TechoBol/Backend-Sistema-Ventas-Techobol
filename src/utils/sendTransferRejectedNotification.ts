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
  rejectedBy: string;
  reason: string;
  products: Product[];
}

export const sendTransferRejectedNotification = async ({
  email,
  employee,
  transferCode,
  origin,
  destination,
  rejectedBy,
  reason,
  products,
}: Props) => {

  await transporter.sendMail({
    from: process.env.USER_EMAIL,
    to: email,
    subject: `Transferencia ${transferCode} rechazada`,
    html: transferEmailTemplate({
      title: "Transferencia Rechazada",
      status: "RECHAZADA",
      statusColor: "#dc2626",
      employee,
      transferCode,
      origin,
      destination,
      actionByLabel: "Rechazado por",
      actionBy: rejectedBy,
      reason,
      message: `
        La transferencia <b>${transferCode}</b> fue
        <b style="color:#dc2626;">RECHAZADA</b>.
      `,
      products,
    })
  });
};