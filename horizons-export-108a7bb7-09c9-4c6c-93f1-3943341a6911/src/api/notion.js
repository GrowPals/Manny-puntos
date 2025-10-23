
// This is a mock API to simulate interaction with Notion.
// In a real-world scenario, this would be a backend service talking to the Notion API.

const NOTION_DATA_KEY = 'manny_notion_db';

const getInitialData = () => ({
  clientes: [
    { id: '1', telefono: '4771112222', nombre: 'Ana García', puntos_actuales: 340, ultimo_servicio: 'Revisión eléctrica', fecha_ultimo_servicio: '2025-10-15', fecha_registro: '2025-01-01' },
    { id: '2', telefono: '4773334444', nombre: 'Carlos Sanchez', puntos_actuales: 120, ultimo_servicio: 'Instalación de tuberías', fecha_ultimo_servicio: '2025-10-10', fecha_registro: '2025-02-15' },
    { id: '3', telefono: '4775556666', nombre: 'Luisa Perez', puntos_actuales: 80, ultimo_servicio: 'Reparación de fuga', fecha_ultimo_servicio: '2025-09-28', fecha_registro: '2025-03-20' },
    // Super Admin / Test User
    { 
      id: 'admin', 
      telefono: '4624844148', 
      nombre: 'Usuario de Prueba', 
      puntos_actuales: 500,
      es_admin: true,
      ultimo_servicio: 'Reparación eléctrica', 
      fecha_ultimo_servicio: '2024-01-15',
      fecha_registro: '2024-01-01'
    },
  ],
  productos: [
    { id: 'p1', nombre: 'Revisión Eléctrica Gratis', descripcion: 'Canjea tus puntos por una revisión completa de tu sistema eléctrico.', puntos_requeridos: 150, imagen_url: '', categoria: 'Servicios', stock: 50, activo: true },
    { id: 'p2', nombre: 'Kit de Herramientas Básico', descripcion: 'Un juego de destornilladores y pinzas para reparaciones menores.', puntos_requeridos: 80, imagen_url: '', categoria: 'Herramientas', stock: 100, activo: true },
    { id: 'p3', nombre: 'Detector de Humo', descripcion: 'Mantén tu hogar seguro con este detector de humo fácil de instalar.', puntos_requeridos: 300, imagen_url: '', categoria: 'Para tu Hogar', stock: 20, activo: false },
    { id: 'p4', nombre: 'Consulta de Plomería', descripcion: 'Resuelve tus dudas con una consulta de 30 minutos con un experto.', puntos_requeridos: 250, imagen_url: '', categoria: 'Servicios', stock: 0, activo: true },
  ],
  canjes: [
     { id: 'c1', cliente_telefono: '4771112222', producto_id: 'p2', puntos_usados: 80, fecha: '2025-09-20T10:00:00.000Z', estado: 'entregado' },
     { id: 'c2', cliente_telefono: '4624844148', producto_id: 'p1', puntos_usados: 150, fecha: '2025-10-22T10:00:00.000Z', estado: 'pendiente_recoger' },
  ],
  servicios_historicos: {
    '4624844148': [
      { fecha: "2024-01-15", servicio: "Reparación eléctrica", puntos_ganados: 50 },
      { fecha: "2024-01-10", servicio: "Mantenimiento plomería", puntos_ganados: 30 }
    ],
    '4771112222': [
      { fecha: "2025-10-15", servicio: "Revisión eléctrica", puntos_ganados: 25 },
      { fecha: "2025-09-01", servicio: "Instalación de tuberías", puntos_ganados: 40 }
    ]
  }
});

const getDb = () => {
  try {
    const data = localStorage.getItem(NOTION_DATA_KEY);
    if (data) {
      const parsedData = JSON.parse(data);
      // Simple validation: check if the admin user exists. If not, reset the data.
      if (parsedData.clientes && parsedData.clientes.find(c => c.telefono === '4624844148')) {
        return parsedData;
      }
    }
  } catch (error) {
    console.error("Failed to parse Notion DB from localStorage, resetting.", error);
  }
  // If data is missing, invalid, or corrupted, reset to initial state.
  console.log("Resetting Notion DB to initial state.");
  const initialData = getInitialData();
  localStorage.setItem(NOTION_DATA_KEY, JSON.stringify(initialData));
  return initialData;
};

const saveDb = (db) => {
  localStorage.setItem(NOTION_DATA_KEY, JSON.stringify(db));
};

// --- CLIENT API ---

export const getClienteByTelefono = async (telefono) => {
  console.log(`[API] Buscando cliente con teléfono: ${telefono}`);
  const db = getDb();
  if (!/^\d{10}$/.test(telefono)) {
      throw new Error('Número de teléfono inválido.');
  }
  const cliente = db.clientes.find(c => c.telefono === telefono);
  if (!cliente) {
    throw new Error('Número no registrado. Solo clientes existentes pueden acceder.');
  }
  return { ...cliente };
};

export const getClienteHistorial = async (telefono) => {
  console.log(`[API] Obteniendo historial para: ${telefono}`);
  const db = getDb();
  const canjesCliente = db.canjes
    .filter(c => c.cliente_telefono === telefono)
    .map(c => {
      const producto = db.productos.find(p => p.id === c.producto_id);
      return { ...c, producto_nombre: producto?.nombre || 'Producto no encontrado' };
    });

  const servicios = db.servicios_historicos[telefono] || [];
  
  return { canjes: canjesCliente.reverse(), servicios };
};

export const getTodosLosClientes = async () => {
  const db = getDb();
  return [...db.clientes];
};

// --- PRODUCT API ---

export const getProductosCanje = async () => {
  console.log('[API] Obteniendo todos los productos');
  const db = getDb();
  return [...db.productos];
};

export const getProductoById = async (id) => {
    console.log(`[API] Buscando producto con id: ${id}`);
    const db = getDb();
    const producto = db.productos.find(p => p.id === id);
    if (!producto) {
        throw new Error('Producto no encontrado');
    }
    return { ...producto };
};

export const crearOActualizarProducto = async (productoData) => {
    console.log('[API] Creando/Actualizando producto', productoData);
    const db = getDb();
    if(productoData.id) {
        const index = db.productos.findIndex(p => p.id === productoData.id);
        if(index > -1) {
            db.productos[index] = { ...db.productos[index], ...productoData };
        }
    } else { 
        const nuevoProducto = {
            id: `p${Date.now()}`,
            ...productoData,
            puntos_requeridos: parseInt(productoData.puntos_requeridos, 10) || 0,
            stock: parseInt(productoData.stock, 10) || 0,
            activo: productoData.activo !== undefined ? productoData.activo : true,
        };
        db.productos.push(nuevoProducto);
    }
    saveDb(db);
    return true;
};

export const eliminarProducto = async (productoId) => {
    console.log(`[API] Eliminando producto: ${productoId}`);
    const db = getDb();
    db.productos = db.productos.filter(p => p.id !== productoId);
    saveDb(db);
    return true;
};

// --- CANJE API ---

export const registrarCanje = async ({ cliente_telefono, producto_id }) => {
  console.log(`[API] Registrando canje para ${cliente_telefono}, producto ${producto_id}`);
  const db = getDb();
  
  const cliente = db.clientes.find(c => c.telefono === cliente_telefono);
  const producto = db.productos.find(p => p.id === producto_id);

  if (!cliente || !producto) {
    throw new Error('Cliente o producto no válido.');
  }

  if (cliente.puntos_actuales < producto.puntos_requeridos) {
    throw new Error('No tienes puntos Manny suficientes.');
  }
  
  if (!producto.activo || producto.stock <= 0) {
      throw new Error('Este producto no está disponible o está agotado.');
  }

  cliente.puntos_actuales -= producto.puntos_requeridos;
  producto.stock -= 1;

  const nuevoCanje = {
    id: `c${Date.now()}`,
    cliente_telefono,
    producto_id,
    puntos_usados: producto.puntos_requeridos,
    fecha: new Date().toISOString(),
    estado: 'pendiente_recoger'
  };

  db.canjes.push(nuevoCanje);
  saveDb(db);
  
  return { nuevoSaldo: cliente.puntos_actuales, canje: nuevoCanje };
};

export const getCanjesPendientes = async () => {
    console.log('[API] Obteniendo canjes pendientes');
    const db = getDb();
    return db.canjes
        .filter(c => c.estado === 'pendiente_recoger')
        .map(c => {
            const cliente = db.clientes.find(cli => cli.telefono === c.cliente_telefono);
            const producto = db.productos.find(p => p.id === c.producto_id);
            return {
                ...c,
                cliente_nombre: cliente?.nombre || 'N/A',
                producto_nombre: producto?.nombre || 'N/A',
            };
        })
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
};

export const marcarCanjeComoEntregado = async (canjeId) => {
    console.log(`[API] Marcando canje ${canjeId} como entregado`);
    const db = getDb();
    const canje = db.canjes.find(c => c.id === canjeId);
    if (!canje) {
        throw new Error('Canje no encontrado');
    }
    canje.estado = 'entregado';
    saveDb(db);
    return true;
};
