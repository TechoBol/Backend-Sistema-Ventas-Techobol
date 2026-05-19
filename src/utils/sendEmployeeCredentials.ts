import transporter from "../services/nodemailer";

interface Props {
  email: string;
  name: string;
  lastName: string;
  password: string;
}

export const sendEmployeeCredentials = async ({
  email,
  name,
  lastName,
  password,
}: Props) => {
  await transporter.sendMail({
    from: process.env.USER_EMAIL,
    to: email,
    subject: "Credenciales de acceso",
    html: `
      <div style="font-family: Arial">
        <h2>Bienvenido/a ${name} ${lastName}</h2>

        <p>Tu cuenta ha sido creada correctamente.</p>

        <p><b>Correo:</b> ${email}</p>
        <p><b>Contraseña:</b> ${password}</p>

        <p>Te recomendamos guardar tu contraseña debido a que no se puede recuperar ni cambiar.</p>
      </div>
    `,
  });
};
