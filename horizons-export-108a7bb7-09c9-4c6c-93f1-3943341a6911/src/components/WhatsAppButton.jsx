
import React from 'react';
import { motion } from 'framer-motion';

const WhatsAppButton = () => {
    const phoneNumber = '1234567890';
    const message = encodeURIComponent('Hola Manny, necesito ayuda con mi cuenta de recompensas.');
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;

    return (
        <motion.a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-whatsapp fixed bottom-6 right-6 w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl z-50"
            whileHover={{ scale: 1.1, y: -2 }}
            whileTap={{ scale: 0.9 }}
            aria-label="Contactar por WhatsApp"
        >
            <svg
                className="w-8 h-8 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <path
                    d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.487 5.235 3.487 8.413 0 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.886-.001 2.269.655 4.357 1.849 6.267l.22.368-1.64 5.993 6.11-1.601.351.21z"
                />
            </svg>
        </motion.a>
    );
};

export default WhatsAppButton;
