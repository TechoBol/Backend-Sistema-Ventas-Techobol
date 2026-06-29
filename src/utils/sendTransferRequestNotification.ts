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
  requestedBy: string;
  products: Product[];
}

export const sendTransferRequestNotification = async ({
  email,
  employee,
  transferCode,
  origin,
  destination,
  requestedBy,
  products,
}: Props) => {

  await transporter.sendMail({
    from: process.env.USER_EMAIL,
    to: email,
    subject: `Nueva solicitud de transferencia ${transferCode}`,
    html: transferEmailTemplate({
      title: "Nueva Solicitud de Transferencia",
      status: "SOLICITADA",
      statusColor: "#2563eb",
      employee,
      transferCode,
      origin,
      destination,
      actionByLabel: "Solicitado por",
      actionBy: requestedBy,
      message: `
        Se registró una nueva solicitud de transferencia.
      `,
      products,
    })
  });
};