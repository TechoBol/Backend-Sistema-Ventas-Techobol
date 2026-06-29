import transporter from "../services/nodemailer";

interface Product {
      code: string;
      name: string;
      unidad: string;
      quantity: number;
    }

interface Props {
  email: string;
  branch: string;
  saleCode: string;
  customer: string;
  products: Product[];
}

export const sendMultiBranchSale = async ({
  email,
  branch,
  saleCode,
  customer,
  products,
}: Props) => {
      const rows = products
      .map(
        (p) => `
          <tr>
            <td>${p.code}</td>
            <td>${p.name}</td>
            <td>${p.unidad}</td>
            <td>${p.quantity}</td>
          </tr>
        `
      )
      .join("");

  await transporter.sendMail({
    to: email,
    subject: `Venta ${saleCode}`,
    html: `
      <h2>Nueva solicitud de productos</h2>

      <p>La sucursal <b>${branch}</b> realizó una venta que requiere productos de tu sucursal.</p>

      <p><b>Cliente:</b> ${customer}</p>
      <p><b>Venta:</b> ${saleCode}</p>

      <table border="1" cellpadding="6" cellspacing="0">
        <thead>
          <tr>
          <th>Codigo</th>
            <th>Producto</th>
            <th>Unidad</th>
            <th>Cantidad</th>
          </tr>
        </thead>

        <tbody>
          ${rows}
        </tbody>
      </table>

      <p>Por favor prepara los productos para el recojo.</p>
    `,
  });
};
