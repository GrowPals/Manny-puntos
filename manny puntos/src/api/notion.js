
// This is a mock API to simulate interaction with Notion.
// In a real-world scenario, this would be a backend service talking to the Notion API.

const NOTION_DATA_KEY = 'manny_notion_db';
const DB_VERSION = "1.3"; // Incremented version for migration logic

const getInitialData = () => ({
  version: DB_VERSION,
  lastUpdated: new Date().toISOString(),
  configuracion: {
    empresa_nombre: "Manny",
    puntos_por_servicio: {},
    mensajes_canje: {
      producto: "¡Listo! Te lo llevamos en tu próximo servicio",
      servicio: "¡Listo! Ya estás en nuestra lista. Te avisaremos un día antes para coordinar"
    }
  },
  clientes: [
    { id: '1', telefono: '4771112222', nombre: 'Ana García', puntos_actuales: 340, ultimo_servicio: 'Consulta médica', fecha_ultimo_servicio: '2025-10-15', fecha_registro: '2025-01-01', es_admin: false, historial_puntos: [] },
    { id: '2', telefono: '4773334444', nombre: 'Carlos Sanchez', puntos_actuales: 120, ultimo_servicio: 'Terapia física', fecha_ultimo_servicio: '2025-10-10', fecha_registro: '2025-02-15', es_admin: false, historial_puntos: [] },
    { id: 'admin', telefono: '4624844148', nombre: 'Admin', puntos_actuales: 9999, ultimo_servicio: 'N/A', fecha_ultimo_servicio: new Date().toISOString(), fecha_registro: new Date().toISOString(), es_admin: true, historial_puntos: [] },
  ],
  productos: [
    { id: 'p1', nombre: 'Consulta de seguimiento gratis', descripcion: 'Canjea tus puntos por una consulta de seguimiento sin costo.', tipo: 'servicio', puntos_requeridos: 150, imagen_url: '', categoria: 'Salud', stock: 999, activo: true },
    { id: 'p2', nombre: 'Descuento del 20% en Terapia', descripcion: 'Obtén un 20% de descuento en tu próxima sesión de terapia.', tipo: 'servicio', puntos_requeridos: 80, imagen_url: '', categoria: 'Bienestar', stock: 999, activo: true },
    { id: 'p3', nombre: 'Kit de Bienestar', descripcion: 'Un kit con productos esenciales para tu cuidado diario.', tipo: 'producto', puntos_requeridos: 300, imagen_url: '', categoria: 'Cuidado Personal', stock: 20, activo: true },
  ],
  canjes: [
     { id: 'c1', cliente_id: '1', cliente_telefono: '4771112222', producto_id: 'p2', tipo: 'servicio', puntos_usados: 80, fecha: '2025-09-20T10:00:00.000Z', estado: 'completado' },
     { id: 'c2', cliente_id: '1', cliente_telefono: '4771112222', producto_id: 'p3', tipo: 'producto', puntos_usados: 300, fecha: '2025-09-25T10:00:00.000Z', estado: 'entregado' },
     { id: 'c3', cliente_id: '2', cliente_telefono: '4773334444', producto_id: 'p2', tipo: 'servicio', puntos_usados: 80, fecha: '2025-10-18T10:00:00.000Z', estado: 'en_lista' },
  ],
});

const saveDb = (db) => {
  try {
    db.lastUpdated = new Date().toISOString();
    db.version = DB_VERSION;
    localStorage.setItem(NOTION_DATA_KEY, JSON.stringify(db));
  } catch (error) {
    console.error("Failed to save DB to localStorage", error);
  }
};

const getDb = () => {
  try {
    const data = localStorage.getItem(NOTION_DATA_KEY);
    if (!data) {
        const initialData = getInitialData();
        saveDb(initialData);
        return initialData;
    }
    
    const parsedData = JSON.parse(data);

    if (!parsedData.version || parsedData.version !== DB_VERSION) {
      console.warn(`Database version mismatch. Old: ${parsedData.version}, New: ${DB_VERSION}. Migrating...`);
      const initial = getInitialData();
      const migratedData = {
        ...initial,
        clientes: parsedData.clientes || initial.clientes,
        productos: parsedData.productos || initial.productos,
        canjes: parsedData.canjes || initial.canjes,
        version: DB_VERSION,
      };
      
      // Ensure all clients have `puntos_actuales` as a number
      migratedData.clientes = migratedData.clientes.map(c => ({
        ...c,
        puntos_actuales: Number(c.puntos_actuales) || 0
      }));

      saveDb(migratedData);
      return migratedData;
    }

    return parsedData;

  } catch (error) {
    console.error("Failed to parse or migrate DB from localStorage. Resetting to initial data.", error);
    const initialData = getInitialData();
    saveDb(initialData);
    return initialData;
  }
};

// --- DATA MANAGEMENT API ---
export const exportMannyData = () => {
  const db = getDb();
  const blob = new Blob([JSON.stringify(db, null, 2)], {
    type: 'application/json'
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `manny-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importMannyData = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);

        if (!importedData.version || !importedData.clientes || !importedData.productos || !importedData.canjes) {
          throw new Error("El archivo de respaldo no tiene el formato correcto o está corrupto.");
        }
        
        saveDb(importedData);
        resolve("Datos importados con éxito. La página se recargará.");
      } catch (e) {
        reject(new Error("Error al procesar el archivo: " + e.message));
      }
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsText(file);
  });
};


// --- CLIENT API ---

export const getClienteByTelefono = async (telefono) => {
  const db = getDb();
  const cliente = db.clientes.find(c => c.telefono === telefono);
  if (!cliente) {
    throw new Error('Número no registrado');
  }
  return { ...cliente };
};

export const getTodosLosClientes = async () => {
  const db = getDb();
  return [...db.clientes];
};

export const getClienteHistorial = async (telefono) => {
  const db = getDb();
  const cliente = db.clientes.find(c => c.telefono === telefono);
  if (!cliente) {
    return { canjes: [], servicios: [] };
  }

  const canjesCliente = db.canjes
    .filter(c => c.cliente_id === cliente.id)
    .map(c => {
      const producto = db.productos.find(p => p.id === c.producto_id);
      return { ...c, producto_nombre: producto?.nombre || 'Recompensa eliminada', tipo: producto?.tipo || 'producto' };
    });
  
  const transaccionesPuntos = cliente.historial_puntos || [];
  
  return { canjes: canjesCliente, servicios: transaccionesPuntos };
};

export const crearOActualizarCliente = async (clienteData) => {
  const db = getDb();
  if (clienteData.id) { // Update
    const index = db.clientes.findIndex(c => c.id === clienteData.id);
    if (index > -1) {
      db.clientes[index] = { ...db.clientes[index], ...clienteData, telefono: db.clientes[index].telefono, puntos_actuales: Number(clienteData.puntos_actuales) || 0 }; // Prevent phone number change on edit
    }
  } else { // Create
    if(db.clientes.some(c => c.telefono === clienteData.telefono)) {
      throw new Error("Este número de teléfono ya está registrado.");
    }
    const nuevoCliente = {
      id: `cli_${Date.now()}`,
      telefono: clienteData.telefono,
      nombre: clienteData.nombre,
      puntos_actuales: Number(clienteData.puntos_actuales) || 0,
      ultimo_servicio: clienteData.ultimo_servicio || 'Registro',
      fecha_ultimo_servicio: new Date().toISOString(),
      fecha_registro: new Date().toISOString(),
      es_admin: clienteData.es_admin || false,
      historial_puntos: []
    };
    db.clientes.push(nuevoCliente);
  }
  saveDb(db);
  return true;
};

export const asignarPuntosManualmente = async (clienteTelefono, puntos, concepto) => {
  const db = getDb();
  const clienteIndex = db.clientes.findIndex(c => c.telefono === clienteTelefono);
  if (clienteIndex === -1) throw new Error('Cliente no encontrado');
  
  const cliente = db.clientes[clienteIndex];
  cliente.puntos_actuales = (Number(cliente.puntos_actuales) || 0) + parseInt(puntos, 10);
  
  if (!cliente.historial_puntos) cliente.historial_puntos = [];
  cliente.historial_puntos.push({
    id: `t_${Date.now()}`,
    puntos: parseInt(puntos, 10),
    concepto: concepto || 'Ajuste manual',
    fecha: new Date().toISOString(),
  });
  
  db.clientes[clienteIndex] = cliente;
  saveDb(db);
  return cliente.puntos_actuales;
};

export const cambiarRolAdmin = async (clienteId, esAdmin) => {
  const db = getDb();
  const clienteIndex = db.clientes.findIndex(c => c.id === clienteId);
  if (clienteIndex === -1) {
    throw new Error('Cliente no encontrado');
  }
  db.clientes[clienteIndex].es_admin = esAdmin;
  saveDb(db);
  return db.clientes[clienteIndex];
};

// --- PRODUCT API ---

export const getProductosCanje = async () => {
  const db = getDb();
  return [...db.productos];
};

export const getProductoById = async (id) => {
    const db = getDb();
    const producto = db.productos.find(p => p.id === id);
    if (!producto) {
        throw new Error('Producto no encontrado');
    }
    return { ...producto };
};

export const crearOActualizarProducto = async (productoData) => {
  const db = getDb();
  
  const parsedData = {
    ...productoData,
    puntos_requeridos: parseInt(productoData.puntos_requeridos, 10) || 0,
    stock: productoData.tipo === 'producto' ? (parseInt(productoData.stock, 10) || 0) : 999,
    activo: productoData.activo !== undefined ? productoData.activo : true,
  };

  if (parsedData.id) {
    const index = db.productos.findIndex(p => p.id === parsedData.id);
    if (index > -1) {
      db.productos[index] = { ...db.productos[index], ...parsedData };
    }
  } else {
    const nuevoProducto = {
      ...parsedData,
      id: `p_${Date.now()}`,
      categoria: parsedData.categoria || 'General',
      imagen_url: parsedData.imagen_url || '',
    };
    db.productos.push(nuevoProducto);
  }
  saveDb(db);
  return true;
};

export const eliminarProducto = async (productoId) => {
  const db = getDb();
  db.productos = db.productos.filter(p => p.id !== productoId);
  saveDb(db);
  return true;
};

export const subirImagenProducto = async (archivo) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); 
    reader.onerror = (error) => reject(new Error('Error al leer el archivo de imagen: ' + error));
    reader.readAsDataURL(archivo);
  });
};

// --- CANJE API ---

export const getTodosLosCanjes = async () => {
    const db = getDb();
    return db.canjes
        .map(c => {
            const cliente = db.clientes.find(cli => cli.id === c.cliente_id);
            const producto = db.productos.find(p => p.id === c.producto_id);
            return {
                ...c,
                cliente_nombre: cliente?.nombre || 'Usuario eliminado',
                cliente_telefono: cliente?.telefono || 'N/A',
                producto_nombre: producto?.nombre || 'Recompensa eliminada',
                tipo: producto?.tipo || c.tipo || 'producto'
            };
        })
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
};

export const getCanjesPendientes = async () => {
    const allCanjes = await getTodosLosCanjes();
    return allCanjes.filter(c => c.estado === 'pendiente_entrega' || c.estado === 'en_lista');
}

export const registrarCanje = async ({ cliente_telefono, producto_id }) => {
  const db = getDb();
  
  const clienteIndex = db.clientes.findIndex(c => c.telefono === cliente_telefono);
  const productoIndex = db.productos.findIndex(p => p.id === producto_id);

  if (clienteIndex === -1 || productoIndex === -1) throw new Error('Cliente o producto no válido.');
  
  const cliente = db.clientes[clienteIndex];
  const producto = db.productos[productoIndex];

  if (!producto.tipo) throw new Error('El tipo de producto no está definido.');
  if (cliente.puntos_actuales < producto.puntos_requeridos) throw new Error('No tienes puntos suficientes.');
  if (producto.tipo === 'producto' && producto.stock <= 0) throw new Error('Producto agotado.');
  if (!producto.activo) throw new Error('Esta recompensa no está disponible actualmente.');

  cliente.puntos_actuales -= producto.puntos_requeridos;
  if(producto.tipo === 'producto') {
      producto.stock -= 1;
  }
  
  db.clientes[clienteIndex] = cliente;
  db.productos[productoIndex] = producto;
  
  const estado_inicial = producto.tipo === 'producto' ? 'pendiente_entrega' : 'en_lista';

  const nuevoCanje = {
    id: `c_${Date.now()}`,
    cliente_id: cliente.id,
    producto_id,
    tipo: producto.tipo,
    puntos_usados: producto.puntos_requeridos,
    fecha: new Date().toISOString(),
    estado: estado_inicial,
  };

  db.canjes.push(nuevoCanje);
  saveDb(db);
  
  const mensajes = db.configuracion.mensajes_canje;
  
  return { 
    nuevoSaldo: cliente.puntos_actuales, 
    canje: nuevoCanje,
    mensaje: mensajes[producto.tipo] || mensajes.producto
  };
};

export const actualizarEstadoCanje = async (canjeId, nuevoEstado) => {
    const db = getDb();
    const canjeIndex = db.canjes.findIndex(c => c.id === canjeId);
    if (canjeIndex === -1) throw new Error('Canje no encontrado');
    
    const canje = db.canjes[canjeIndex];
    canje.estado = nuevoEstado;
    if (nuevoEstado === 'entregado' || nuevoEstado === 'completado') {
      canje.fecha_entrega = new Date().toISOString();
    }
    
    db.canjes[canjeIndex] = canje;
    saveDb(db);
    return canje;
};

export const cambiarEstadoEntrega = actualizarEstadoCanje;
