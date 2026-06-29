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
  approvedBy: string;
  products: Product[];
}

export const sendTransferNotification = async ({
  email,
  employee,
  transferCode,
  origin,
  destination,
  approvedBy,
  products,
}: Props) => {
  
  await transporter.sendMail({
    from: process.env.USER_EMAIL,
    to: email,
    subject: `Transferencia ${transferCode} aprobada`,
    html: transferEmailTemplate({
      title: "Transferencia Aprobada",
      status: "APROBADA",
      statusColor: "#16a34a",
      employee,
      transferCode,
      origin,
      destination,
      actionByLabel: "Aprobado por",
      actionBy: approvedBy,
      message: `
        La transferencia <b>${transferCode}</b> fue
        <b style="color:#16a34a;">APROBADA</b>.
      `,
      products,
    })
  });

  console.log(`✅ Correo enviado a ${email}`);
};