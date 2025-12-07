import { supabase } from '@/lib/customSupabaseClient';

export const exportMannyData = async () => {
    const { data: clientes, error: e1 } = await supabase.from('clientes').select('*');
    if (e1) throw new Error(`Error exportando clientes: ${e1.message}`);
    const { data: productos, error: e2 } = await supabase.from('productos').select('*');
    if (e2) throw new Error(`Error exportando productos: ${e2.message}`);
    const { data: canjes, error: e3 } = await supabase.from('canjes').select('*');
    if (e3) throw new Error(`Error exportando canjes: ${e3.message}`);
    const { data: historial, error: e4 } = await supabase.from('historial_puntos').select('*');
    if(e4) throw new Error(`Error exportando historial: ${e4.message}`);

    const fullData = { clientes, productos, canjes, historial_puntos: historial, version: 'supabase-1.0' };
    
    const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `manny-supabase-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const importMannyData = async (data) => {
    if (!data.clientes || !data.productos) throw new Error("El archivo no tiene el formato correcto.");

    if (data.clientes) {
        const { error } = await supabase.from('clientes').upsert(data.clientes, { onConflict: 'telefono' });
        if (error) throw new Error(`Error importando clientes: ${error.message}`);
    }
    if (data.productos) {
        const { error } = await supabase.from('productos').upsert(data.productos, { onConflict: 'id' });
        if (error) throw new Error(`Error importando productos: ${error.message}`);
    }
    if (data.canjes) {
            const { error } = await supabase.from('canjes').upsert(data.canjes, { onConflict: 'id' });
            if (error) console.error(`Error importando canjes: ${error.message}`);
    }
    if (data.historial_puntos) {
            const { error } = await supabase.from('historial_puntos').upsert(data.historial_puntos, { onConflict: 'id' });
            if (error) console.error(`Error importando historial: ${error.message}`);
    }
    return true;
};
