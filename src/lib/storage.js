/**
 * Storage utilities for image upload operations
 * Consolidates duplicated validation logic from products.js and gifts.js
 */

import { supabase } from '@/lib/customSupabaseClient';
import { logger } from '@/lib/logger';
import { STORAGE_CONFIG } from '@/config';

// Bucket name - centralized
const BUCKET_NAME = 'recompensas';

// Extended valid types (include gif which was in the services but not in config)
const VALID_IMAGE_TYPES = [...STORAGE_CONFIG.ALLOWED_IMAGE_TYPES, 'image/gif'];

/**
 * Validates an image file for upload
 * @param {File} file - The file to validate
 * @throws {Error} If file is invalid
 */
export const validateImageFile = (file) => {
  if (!file) {
    throw new Error('No se seleccionó ningún archivo');
  }

  if (!VALID_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Tipo de archivo no válido. Usa JPG, PNG, WebP o GIF.');
  }

  if (file.size > STORAGE_CONFIG.MAX_IMAGE_SIZE) {
    throw new Error('El archivo es muy grande. Máximo 5MB.');
  }
};

/**
 * Generates a unique filename for storage
 * @param {File} file - The original file
 * @param {string} prefix - Optional prefix for the filename
 * @returns {string} Unique filename
 */
export const generateUniqueFileName = (file, prefix = '') => {
  const fileExt = file.name.split('.').pop();
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  return `${prefix}${uniqueId}.${fileExt}`;
};

/**
 * Uploads an image to Supabase storage
 * @param {File} file - The file to upload
 * @param {string} folderPath - The folder path within the bucket (e.g., 'productos', 'regalos/banners')
 * @param {Object} options - Upload options
 * @param {string} options.context - Context for error logging
 * @returns {Promise<string>} Public URL of the uploaded image
 */
export const uploadImage = async (file, folderPath, { context = 'image' } = {}) => {
  // Validate the file
  validateImageFile(file);

  // Generate unique filename
  const fileName = generateUniqueFileName(file);
  const filePath = `${folderPath}/${fileName}`;

  // Upload to Supabase
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) {
    logger.error(`Error uploading ${context}`, { error: uploadError.message, fileName });
    throw new Error('Error al subir la imagen. Inténtalo de nuevo.');
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return publicUrl;
};

/**
 * Deletes an image from Supabase storage
 * @param {string} imageUrl - The public URL of the image to delete
 * @returns {Promise<boolean>} True if deleted successfully
 */
export const deleteImage = async (imageUrl) => {
  if (!imageUrl) return true;

  try {
    // Extract the path from the URL
    // URL format: https://xxx.supabase.co/storage/v1/object/public/recompensas/path/to/file.ext
    const urlParts = imageUrl.split(`/${BUCKET_NAME}/`);
    if (urlParts.length < 2) {
      logger.warn('Could not parse image URL for deletion', { imageUrl });
      return false;
    }

    const filePath = urlParts[1];

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      logger.error('Error deleting image', { error: error.message, filePath });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error in deleteImage', { error: error.message });
    return false;
  }
};
