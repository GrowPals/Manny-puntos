
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getProduct, getProductQuantities } from '@/api/EcommerceApi';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/components/ui/use-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ShoppingCart, Loader2, ArrowLeft, CheckCircle, Minus, Plus, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';

const placeholderImage = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZWNlZmYxIi8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iI2QxZDVlMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlNpbiBpbWFnZW48L3RleHQ+Cjwvc3ZnPgo=";

function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { addToCart } = useCart();
  const { toast } = useToast();

  useEffect(() => {
    const fetchProductData = async () => {
      try {
        setLoading(true);
        setError(null);
        const fetchedProduct = await getProduct(id);

        const quantitiesResponse = await getProductQuantities({
          fields: 'inventory_quantity',
          product_ids: [fetchedProduct.id]
        });

        const variantQuantityMap = new Map();
        quantitiesResponse.variants.forEach(variant => {
          variantQuantityMap.set(variant.id, variant.inventory_quantity);
        });

        const productWithQuantities = {
          ...fetchedProduct,
          variants: fetchedProduct.variants.map(variant => ({
            ...variant,
            inventory_quantity: variantQuantityMap.get(variant.id) ?? variant.inventory_quantity
          }))
        };

        setProduct(productWithQuantities);

        if (productWithQuantities.variants && productWithQuantities.variants.length > 0) {
          setSelectedVariant(productWithQuantities.variants[0]);
        }
      } catch (err) {
        setError(err.message || 'Error al cargar el producto');
      } finally {
        setLoading(false);
      }
    };

    fetchProductData();
  }, [id, navigate]);

  const handleAddToCart = useCallback(async () => {
    if (product && selectedVariant) {
      const availableQuantity = selectedVariant.inventory_quantity;
      try {
        await addToCart(product, selectedVariant, quantity, availableQuantity);
        toast({
          title: "¡Añadido al carrito! 🛒",
          description: `${quantity} x ${product.title} (${selectedVariant.title}) añadido.`,
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "¡Oh no! Algo salió mal.",
          description: error.message,
        });
      }
    }
  }, [product, selectedVariant, quantity, addToCart, toast]);

  const handleQuantityChange = useCallback((amount) => {
    setQuantity(prev => Math.max(1, prev + amount));
  }, []);

  const handlePrevImage = useCallback(() => {
    setCurrentImageIndex(prev => (prev === 0 ? (product.images.length || 1) - 1 : prev - 1));
  }, [product?.images]);

  const handleNextImage = useCallback(() => {
    setCurrentImageIndex(prev => (prev === (product.images.length || 1) - 1 ? 0 : prev + 1));
  }, [product?.images]);

  const handleVariantSelect = useCallback((variant) => {
    setSelectedVariant(variant);
    const imageIndex = product.images.findIndex(img => img.url === variant.image_url);
    if (imageIndex !== -1) {
      setCurrentImageIndex(imageIndex);
    }
  }, [product?.images]);

  const images = product?.images?.length > 0 ? product.images : [{ url: product?.image, order: 1 }];
  const currentImage = images[currentImageIndex] || { url: placeholderImage };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-16 w-16 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="text-center text-red-500 p-8 bg-red-50 rounded-xl max-w-lg mx-auto mt-20">
        <XCircle className="mx-auto h-12 w-12 mb-4" />
        <p className="mb-4">Error al cargar el producto: {error}</p>
        <Link to="/perfil">
          <Button variant="outline">Volver a la tienda</Button>
        </Link>
      </div>
    );
  }

  const price = selectedVariant?.sale_price_formatted ?? selectedVariant?.price_formatted;
  const originalPrice = selectedVariant?.sale_price_in_cents ? selectedVariant?.price_formatted : null;
  const availableStock = selectedVariant ? selectedVariant.inventory_quantity : 0;
  const isStockManaged = selectedVariant?.manage_inventory ?? false;
  const canAddToCart = !isStockManaged || quantity <= availableStock;

  return (
    <>
      <Helmet>
        <title>{product.title} - Manny</title>
        <meta name="description" content={product.description?.substring(0, 160) || product.title} />
      </Helmet>
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Link to="/perfil" className="inline-flex items-center gap-2 text-gray-600 hover:text-orange-500 transition-colors mb-6">
          <ArrowLeft size={16} />
          Volver a la tienda
        </Link>
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 bg-white p-8 rounded-3xl shadow-xl">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative">
            <div className="relative overflow-hidden rounded-lg shadow-lg h-96 md:h-[500px]">
              <img
                src={currentImage.url}
                alt={product.title}
                className="w-full h-full object-cover"
              />
              {images.length > 1 && (
                <>
                  <Button onClick={handlePrevImage} variant="ghost" size="icon" className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full"><ChevronLeft /></Button>
                  <Button onClick={handleNextImage} variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full"><ChevronRight /></Button>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                {images.map((img, index) => (
                  <button key={index} onClick={() => setCurrentImageIndex(index)} className={`w-16 h-16 rounded-md overflow-hidden border-2 ${index === currentImageIndex ? 'border-orange-500' : 'border-transparent'}`}>
                    <img src={img.url} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">{product.title}</h1>
            <p className="text-lg text-gray-500 mb-4">{product.subtitle}</p>

            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-4xl font-bold text-orange-600">{price}</span>
              {originalPrice && <span className="text-2xl text-gray-400 line-through">{originalPrice}</span>}
            </div>

            <div className="prose text-gray-600 mb-6" dangerouslySetInnerHTML={{ __html: product.description }} />

            {product.variants.length > 1 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Estilo</h3>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map(variant => (
                    <Button key={variant.id} variant={selectedVariant?.id === variant.id ? 'default' : 'outline'} onClick={() => handleVariantSelect(variant)} className="rounded-full">{variant.title}</Button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center border border-gray-200 rounded-full p-1">
                <Button onClick={() => handleQuantityChange(-1)} variant="ghost" size="icon" className="rounded-full h-8 w-8"><Minus size={16} /></Button>
                <span className="w-10 text-center font-bold">{quantity}</span>
                <Button onClick={() => handleQuantityChange(1)} variant="ghost" size="icon" className="rounded-full h-8 w-8"><Plus size={16} /></Button>
              </div>
            </div>

            <div className="mt-auto">
              <Button onClick={handleAddToCart} size="lg" className="w-full bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold py-3 text-lg rounded-xl disabled:opacity-50" disabled={!canAddToCart || !product.purchasable}>
                <ShoppingCart className="mr-2 h-5 w-5" /> Añadir al carrito
              </Button>
              {isStockManaged && canAddToCart && product.purchasable && <p className="text-sm text-green-600 mt-3 flex items-center justify-center gap-2"><CheckCircle size={16} /> ¡{availableStock} en stock!</p>}
              {isStockManaged && !canAddToCart && product.purchasable && <p className="text-sm text-yellow-500 mt-3 flex items-center justify-center gap-2"><XCircle size={16} /> Stock insuficiente. Solo quedan {availableStock}.</p>}
              {!product.purchasable && <p className="text-sm text-red-500 mt-3 flex items-center justify-center gap-2"><XCircle size={16} /> No disponible actualmente</p>}
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default ProductDetailPage;
