import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, Wrench, ShieldCheck, Heart } from 'lucide-react';

const SobreNosotros = () => {
    return (
        <>
            <Helmet>
                <title>Sobre Manny - Tu Partner en Mantenimiento</title>
                <meta name="description" content="Conoce más sobre Manny, tu aliado de confianza para el mantenimiento del hogar y la oficina." />
            </Helmet>
            <div className="container mx-auto px-4 py-8">
                <Link to="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8">
                    <ArrowLeft size={16} />
                    Volver al Dashboard
                </Link>
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border rounded-3xl shadow-xl p-8 md:p-12"
                >
                    <div className="text-center mb-10">
                        <img alt="Manny Logo" class="h-20 w-auto mx-auto mb-4" src="https://images.unsplash.com/photo-1542195830-3ac98f429cb4" />
                        <h1 className="text-4xl md:text-5xl">
                            Manny: Tu Partner de Confianza
                        </h1>
                        <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto">
                            Somos más que un servicio de mantenimiento; somos la tranquilidad de saber que tu espacio está en las mejores manos.
                        </p>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-10 items-center">
                        <div>
                            <img className="rounded-2xl shadow-lg w-full h-auto object-cover" alt="Equipo de Manny trabajando" src="https://images.unsplash.com/photo-1612618736568-d0d3888817c0" />
                        </div>
                        <div className="space-y-6">
                            <h2 className="text-3xl">Nuestra Misión</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                En Manny, nuestra misión es simple: hacerte la vida más fácil. Ofrecemos soluciones de mantenimiento integrales, eficientes y confiables para tu hogar y oficina, permitiéndote enfocarte en lo que realmente importa. Creemos en el trabajo bien hecho, la transparencia y, sobre todo, en construir una relación de confianza contigo.
                            </p>
                            <p className="text-muted-foreground leading-relaxed">
                                Nuestro programa de <span className="font-bold text-primary">puntos Manny</span> es nuestra forma de agradecerte por esa confianza. Cada servicio que realizas con nosotros te acerca más a increíbles recompensas, porque para nosotros, eres más que un cliente, <strong className="text-foreground">¡eres nuestro partner!</strong>
                            </p>
                        </div>
                    </div>

                    <div className="mt-16">
                        <h2 className="text-3xl text-center mb-8">¿Por qué elegir a Manny?</h2>
                        <div className="grid sm:grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="text-center p-6 bg-muted/50 rounded-2xl">
                                <ShieldCheck className="w-12 h-12 text-primary mx-auto mb-4" />
                                <h3 className="text-xl mb-2">Calidad Garantizada</h3>
                                <p className="text-muted-foreground">Utilizamos los mejores materiales y técnicos certificados para asegurar un trabajo impecable.</p>
                            </div>
                            <div className="text-center p-6 bg-muted/50 rounded-2xl">
                                <Heart className="w-12 h-12 text-primary mx-auto mb-4" />
                                <h3 className="text-xl mb-2">Servicio Honesto</h3>
                                <p className="text-muted-foreground">Precios justos, comunicación clara y sin sorpresas. Tu confianza es nuestro mayor activo.</p>
                            </div>
                            <div className="text-center p-6 bg-muted/50 rounded-2xl">
                                <Wrench className="w-12 h-12 text-primary mx-auto mb-4" />
                                <h3 className="text-xl mb-2">Soluciones Integrales</h3>
                                <p className="text-muted-foreground">Desde una pequeña reparación hasta un proyecto completo, estamos para ayudarte.</p>
                            </div>
                        </div>
                    </div>
                    <div className="text-center mt-12">
                        <img alt="Sello de Garantía Manny" class="h-32 w-auto mx-auto" src="https://images.unsplash.com/photo-1600063125578-20f7baeb72c6" />
                    </div>
                </motion.div>
            </div>
        </>
    );
};

export default SobreNosotros;