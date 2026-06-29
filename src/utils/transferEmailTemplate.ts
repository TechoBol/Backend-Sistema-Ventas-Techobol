interface Product {
      code: string;
      name: string;
      quantity: number;
    }
    
    interface Props {
      title: string;
      status: string;
      statusColor: string;
      employee: string;
      transferCode: string;
      origin: string;
      destination: string;
      actionByLabel: string;
      actionBy: string;
      reason?: string | null;
      message: string;
      products: Product[];
    }
    
    export const transferEmailTemplate = ({
      title,
      status,
      statusColor,
      employee,
      transferCode,
      origin,
      destination,
      actionByLabel,
      actionBy,
      reason,
      message,
      products,
    }: Props) => {
      const rows = products
        .map(
          (p) => `
          <tr>
            <td style="padding:8px;border:1px solid #ddd;">${p.code}</td>
            <td style="padding:8px;border:1px solid #ddd;">${p.name}</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:center;">
              ${p.quantity}
            </td>
          </tr>
        `,
        )
        .join("");
    
      return `
        <div
          style="
            font-family: Arial, sans-serif;
            background:#f5f5f5;
            padding:30px;
          "
        >
          <div
            style="
              max-width:700px;
              margin:auto;
              background:white;
              border-radius:10px;
              overflow:hidden;
              box-shadow:0 2px 8px rgba(0,0,0,.1);
            "
          >
            <div
              style="
                background:${statusColor};
                color:white;
                padding:20px;
              "
            >
              <h2 style="margin:0;">
                ${title}
              </h2>
            </div>
    
            <div style="padding:25px;">
              <p>
                Hola <b>${employee}</b>,
              </p>
    
              <p>
                ${message}
              </p>
    
              <table
                style="
                  width:100%;
                  margin-top:20px;
                  margin-bottom:25px;
                "
              >
                <tr>
                  <td><b>Código:</b></td>
                  <td>${transferCode}</td>
                </tr>
    
                <tr>
                  <td><b>Estado:</b></td>
                  <td>
                    <b style="color:${statusColor};">
                      ${status}
                    </b>
                  </td>
                </tr>
    
                <tr>
                  <td><b>${actionByLabel}:</b></td>
                  <td>${actionBy}</td>
                </tr>
    
                <tr>
                  <td><b>Origen:</b></td>
                  <td>${origin}</td>
                </tr>
    
                <tr>
                  <td><b>Destino:</b></td>
                  <td>${destination}</td>
                </tr>
    
                ${
                  reason
                    ? `
                    <tr>
                      <td><b>Motivo:</b></td>
                      <td>${reason}</td>
                    </tr>
                  `
                    : ""
                }
              </table>
    
              <h3>Productos</h3>
    
              <table
                style="
                  width:100%;
                  border-collapse:collapse;
                "
              >
                <thead>
                  <tr style="background:#f3f4f6;">
                    <th style="padding:8px;border:1px solid #ddd;">
                      Código
                    </th>
    
                    <th style="padding:8px;border:1px solid #ddd;">
                      Producto
                    </th>
    
                    <th style="padding:8px;border:1px solid #ddd;">
                      Cantidad
                    </th>
                  </tr>
                </thead>
    
                <tbody>
                  ${rows}
                </tbody>
              </table>
    
              <p style="margin-top:30px;">
                Por favor ingresa al sistema para revisar la transferencia.
              </p>
            </div>
          </div>
        </div>
      `;
    };