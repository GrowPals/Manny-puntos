
import React, { createContext, useContext, useMemo } from 'react';
import * as notionApi from '@/api/notion';

const NotionAPIContext = createContext(null);

export const useNotionAPI = () => {
    const context = useContext(NotionAPIContext);
    if (!context) {
        throw new Error('useNotionAPI must be used within a NotionAPIProvider');
    }
    return context;
};

export const NotionAPIProvider = ({ children }) => {
  const api = useMemo(() => ({
    // Data Management
    exportMannyData: notionApi.exportMannyData,
    importMannyData: notionApi.importMannyData,
    // Client
    getClienteByTelefono: notionApi.getClienteByTelefono,
    getTodosLosClientes: notionApi.getTodosLosClientes,
    getClienteHistorial: notionApi.getClienteHistorial,
    crearOActualizarCliente: notionApi.crearOActualizarCliente,
    asignarPuntosManualmente: notionApi.asignarPuntosManualmente,
    cambiarRolAdmin: notionApi.cambiarRolAdmin,
    // Product
    getProductosCanje: notionApi.getProductosCanje,
    getProductoById: notionApi.getProductoById,
    crearOActualizarProducto: notionApi.crearOActualizarProducto,
    eliminarProducto: notionApi.eliminarProducto,
    subirImagenProducto: notionApi.subirImagenProducto,
    // Redemption
    registrarCanje: notionApi.registrarCanje,
    getTodosLosCanjes: notionApi.getTodosLosCanjes,
    getCanjesPendientes: notionApi.getCanjesPendientes,
    actualizarEstadoCanje: notionApi.actualizarEstadoCanje,
    cambiarEstadoEntrega: notionApi.cambiarEstadoEntrega
  }), []);

  return (
    <NotionAPIContext.Provider value={api}>
      {children}
    </NotionAPIContext.Provider>
  );
};
