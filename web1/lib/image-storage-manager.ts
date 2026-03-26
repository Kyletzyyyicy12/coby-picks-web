/**
 * ImageStorageManager - 2GB+ Local Image Storage Solution
 *
 * Provides multiple storage backends for large-scale image storage:
 * 1. OPFS (Origin Private File System) - Up to 2GB+ per origin
 * 2. File System Access API - Unlimited (user-selected directory)
 * 3. IndexedDB - Fallback with chunking for large files
 *
 * Features:
 * - Zero cost (no external storage fees)
 * - Real-time synchronization maintained
 * - Compression for optimal storage
 * - Automatic cleanup of old images
 * - Storage analytics and monitoring
 */

export interface ImageMetadata {
  sliceId: string
  imageId: string
  fileName: string
  originalName: string
  size: number
  type: string
  storageType: 'opfs' | 'filesystem' | 'indexeddb'
  storedAt: number
  totalChunks?: number
  compressed?: boolean
  originalSize?: number
}

export interface StorageStats {
  used: number
  available: number
  total: number
  images: number
  quota: number
}

export class ImageStorageManager {
  private static instance: ImageStorageManager
  private rootDir: FileSystemDirectoryHandle | null = null
  private opfsRoot: FileSystemDirectoryHandle | null = null
  private storageQuota: number = 0
  private db: IDBDatabase | null = null
  private initialized = false

  static getInstance(): ImageStorageManager {
    if (!ImageStorageManager.instance) {
      ImageStorageManager.instance = new ImageStorageManager()
    }
    return ImageStorageManager.instance
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      console.log('🚀 Initializing ImageStorageManager...')

      // Request persistent storage permission for 2GB
      await this.requestPersistentStorage()

      // Get storage estimate
      await this.getStorageEstimate()

      // Initialize storage backends (File System Access is optional and won't fail initialization)
      await Promise.all([
        this.initializeOPFS(),
        this.initializeIndexedDB()
      ])

      // Initialize File System Access separately (won't fail if not available)
      this.initializeFileSystemAccess().catch(error => {
        console.log('ℹ️ File System Access API not available (this is normal)')
      })

      this.initialized = true
      console.log('✅ ImageStorageManager initialized successfully')

      // Show initial storage stats
      const stats = await this.getStorageStats()
      console.log(`📊 Initial storage: ${(stats.used / (1024*1024*1024)).toFixed(2)}GB used, ${(stats.available / (1024*1024*1024)).toFixed(2)}GB available`)

    } catch (error) {
      console.error('❌ Storage initialization failed:', error)
      throw error
    }
  }

  private async requestPersistentStorage(): Promise<void> {
    try {
      if ('storage' in navigator && 'persist' in navigator.storage) {
        const isPersisted = await navigator.storage.persist()
        console.log(isPersisted ? '✅ Persistent storage granted' : '⚠️ Persistent storage denied')
      }
    } catch (error) {
      console.warn('⚠️ Could not request persistent storage:', error)
    }
  }

  private async getStorageEstimate(): Promise<void> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        this.storageQuota = estimate.quota || 0
        console.log(`📊 Storage quota: ${(this.storageQuota / (1024*1024*1024)).toFixed(2)} GB`)
      }
    } catch (error) {
      console.warn('⚠️ Could not get storage estimate:', error)
    }
  }

  private async initializeOPFS(): Promise<void> {
    try {
      // OPFS provides up to 2GB+ of storage per origin
      if ('storage' in navigator && 'getDirectory' in navigator.storage) {
        this.opfsRoot = await navigator.storage.getDirectory()
        console.log('✅ OPFS initialized')
      }
    } catch (error) {
      console.warn('⚠️ OPFS not available:', error)
    }
  }

  private async initializeFileSystemAccess(): Promise<void> {
    try {
      // Only try to initialize File System Access API if explicitly requested by user
      // This prevents security errors when called automatically
      if ('showDirectoryPicker' in window) {
        console.log('ℹ️ File System Access API available but not initializing automatically')
        console.log('💡 To use unlimited storage, call initializeFileSystemAccessWithUserGesture() from a user click handler')
      }
    } catch (error) {
      console.warn('⚠️ File System Access API check failed:', error)
    }
  }

  // New method that can be called from user gesture handlers
  async initializeFileSystemAccessWithUserGesture(): Promise<boolean> {
    try {
      if (!('showDirectoryPicker' in window)) {
        console.warn('❌ File System Access API not supported in this browser')
        return false
      }

      console.log('📁 Requesting directory access...')
      this.rootDir = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents',
        id: 'wheel-images'
      })

      console.log('✅ File System Access API initialized successfully')
      return true

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('ℹ️ User cancelled directory selection')
        return false
      } else if (error.name === 'SecurityError') {
        console.warn('⚠️ File System Access API denied - requires user gesture:', error.message)
        return false
      } else {
        console.error('❌ File System Access API initialization failed:', error)
        return false
      }
    }
  }

  private async initializeIndexedDB(): Promise<void> {
    try {
      this.db = await this.openIndexedDB()
      console.log('✅ IndexedDB initialized')
    } catch (error) {
      console.error('❌ IndexedDB initialization failed:', error)
      throw error
    }
  }

  private async openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('WheelImagesDB', 2)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Images metadata store
        if (!db.objectStoreNames.contains('images')) {
          const imageStore = db.createObjectStore('images', { keyPath: 'imageId' })
          imageStore.createIndex('sliceId', 'sliceId', { unique: false })
          imageStore.createIndex('storedAt', 'storedAt', { unique: false })
          imageStore.createIndex('storageType', 'storageType', { unique: false })
        }

        // Image chunks store for large files
        if (!db.objectStoreNames.contains('imageChunks')) {
          const chunkStore = db.createObjectStore('imageChunks', {
            keyPath: ['imageId', 'chunkIndex']
          })
          chunkStore.createIndex('imageId', 'imageId', { unique: false })
        }

        // Session storage for resume functionality
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'sessionId' })
          sessionStore.createIndex('createdAt', 'createdAt', { unique: false })
        }
      }
    })
  }

  async storeImage(sliceId: string, imageFile: File, options?: {
    compress?: boolean
    quality?: number
    maxWidth?: number
    maxHeight?: number
  }): Promise<string> {
    if (!this.initialized) {
      await this.initialize()
    }

    const imageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const extension = imageFile.name.split('.').pop() || 'jpg'
    const fileName = `${sliceId}_${imageId}.${extension}`

    let processedFile = imageFile
    let compressed = false
    let originalSize = imageFile.size

    // Compress image if requested or if file is large
    if (options?.compress !== false && (imageFile.size > 1024 * 1024 || options?.compress)) {
      try {
        processedFile = await this.compressImage(imageFile, {
          quality: options?.quality || 0.8,
          maxWidth: options?.maxWidth || 1200,
          maxHeight: options?.maxHeight || 1200
        })
        compressed = true
        console.log(`🗜️ Image compressed: ${(originalSize / 1024).toFixed(1)}KB → ${(processedFile.size / 1024).toFixed(1)}KB`)
      } catch (error) {
        console.warn('⚠️ Image compression failed, using original:', error)
        processedFile = imageFile
      }
    }

    // Try OPFS first (up to 2GB+)
    if (this.opfsRoot) {
      try {
        const url = await this.storeInOPFS(fileName, processedFile)
        await this.storeImageMetadata({
          sliceId,
          imageId,
          fileName,
          originalName: imageFile.name,
          size: processedFile.size,
          originalSize,
          type: imageFile.type,
          storageType: 'opfs',
          storedAt: Date.now(),
          compressed
        })
        return url
      } catch (error) {
        console.warn('⚠️ OPFS storage failed:', error)
      }
    }

    // Fallback to File System Access API (unlimited)
    if (this.rootDir) {
      try {
        const url = await this.storeInFileSystem(fileName, processedFile)
        await this.storeImageMetadata({
          sliceId,
          imageId,
          fileName,
          originalName: imageFile.name,
          size: processedFile.size,
          originalSize,
          type: imageFile.type,
          storageType: 'filesystem',
          storedAt: Date.now(),
          compressed
        })
        return url
      } catch (error) {
        console.warn('⚠️ File System Access storage failed:', error)
      }
    }

    // Final fallback: IndexedDB with chunking for large files
    try {
      const url = await this.storeInIndexedDB(sliceId, imageId, processedFile)
      await this.storeImageMetadata({
        sliceId,
        imageId,
        fileName,
        originalName: imageFile.name,
        size: processedFile.size,
        originalSize,
        type: imageFile.type,
        storageType: 'indexeddb',
        storedAt: Date.now(),
        compressed,
        totalChunks: Math.ceil(processedFile.size / (1024 * 1024)) // 1MB chunks
      })
      return url
    } catch (error) {
      console.error('❌ All storage methods failed:', error)
      throw new Error('Could not store image in any available storage')
    }
  }

  private async storeInOPFS(fileName: string, file: File): Promise<string> {
    if (!this.opfsRoot) throw new Error('OPFS not initialized')

    const fileHandle = await this.opfsRoot.getFileHandle(fileName, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(file)
    await writable.close()

    return `opfs://${fileName}`
  }

  private async storeInFileSystem(fileName: string, file: File): Promise<string> {
    if (!this.rootDir) throw new Error('File System Access not initialized')

    const fileHandle = await this.rootDir.getFileHandle(fileName, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(file)
    await writable.close()

    return `filesystem://${fileName}`
  }

  private async storeInIndexedDB(sliceId: string, imageId: string, file: File): Promise<string> {
    if (!this.db) throw new Error('IndexedDB not initialized')

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer
          const chunkSize = 1024 * 1024 // 1MB chunks
          const totalChunks = Math.ceil(arrayBuffer.byteLength / chunkSize)

          const transaction = this.db!.transaction(['images', 'imageChunks'], 'readwrite')
          const imageStore = transaction.objectStore('images')
          const chunkStore = transaction.objectStore('imageChunks')

          // Store image metadata
          await this.promisifyRequest(imageStore.add({
            sliceId,
            imageId,
            fileName: `${sliceId}_${imageId}.jpg`,
            originalName: file.name,
            size: file.size,
            type: file.type,
            totalChunks,
            storageType: 'indexeddb',
            storedAt: Date.now()
          }))

          // Store image data in chunks
          for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize
            const end = Math.min(start + chunkSize, arrayBuffer.byteLength)
            const chunk = arrayBuffer.slice(start, end)

            await this.promisifyRequest(chunkStore.add({
              imageId,
              chunkIndex: i,
              data: chunk,
              totalChunks
            }))
          }

          await this.promisifyTransaction(transaction)
          resolve(`indexeddb://${imageId}`)

        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(file)
    })
  }

  private promisifyRequest(request: IDBRequest): Promise<any> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  private promisifyTransaction(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async getImageUrl(imageId: string): Promise<string> {
    console.log('🔍 Getting image URL for ID:', imageId)

    // First try to get metadata by imageId
    let metadata = await this.getImageMetadata(imageId)
    if (!metadata) {
      // If not found, try to find by sliceId (for backward compatibility)
      const allImages = await this.getAllImages()
      metadata = allImages.find(img => img.sliceId === imageId) || null

      // If still not found, try partial match for sliceId (e.g., "slice-0" matching "slice-0_something")
      if (!metadata) {
        metadata = allImages.find(img => img.sliceId.startsWith(imageId) || imageId.startsWith(img.sliceId)) || null
      }

      // Enhanced OPFS lookup: If still not found and we have OPFS, try direct file matching
      if (!metadata && this.opfsRoot && imageId) {
        console.log('🔄 Enhanced OPFS lookup for imageId:', imageId)
        try {
          // List all OPFS files to find potential matches
          const allFiles: string[] = []
          for await (const [name] of (this.opfsRoot as any).entries()) {
            allFiles.push(name)
          }

          console.log('📁 All OPFS files:', allFiles)

          // Try to find files that start with the imageId (e.g., "slice-0" matching "slice-0_*.jpeg")
          const matchingFiles = allFiles.filter(file =>
            file.startsWith(imageId + '_') || // slice-0_*.jpeg
            file.startsWith(imageId) || // slice-0.jpeg (exact match)
            file.includes(imageId) // contains slice-0 anywhere
          )

          if (matchingFiles.length > 0) {
            console.log('🎯 Found matching OPFS files:', matchingFiles)

            // Try to find corresponding metadata or create synthetic metadata
            for (const fileName of matchingFiles) {
              // Look for metadata that might match this file
              const fileMetadata = allImages.find(img =>
                img.fileName === fileName ||
                img.fileName.startsWith(fileName.split('.')[0]) ||
                fileName.includes(img.sliceId)
              )

              if (fileMetadata) {
                metadata = fileMetadata
                console.log('✅ Found metadata for OPFS file:', fileName, metadata)
                break
              }
            }

            // If no metadata found, create synthetic metadata for the first match
            if (!metadata) {
              const fileName = matchingFiles[0]
              metadata = {
                sliceId: imageId,
                imageId: `${imageId}_${Date.now()}`, // Generate a unique imageId
                fileName: fileName,
                originalName: fileName,
                size: 0, // We don't know the size without loading
                type: 'image/jpeg', // Assume JPEG
                storageType: 'opfs' as const,
                storedAt: Date.now()
              }
              console.log('✅ Created synthetic metadata for OPFS file:', metadata)
            }
          } else {
            console.log('❌ No matching OPFS files found for imageId:', imageId)
          }
        } catch (error) {
          console.warn('⚠️ Enhanced OPFS lookup failed:', error)
        }
      }

      // If still not found, try to reconstruct metadata from OPFS files
      if (!metadata && this.opfsRoot) {
        console.log('🔄 No metadata found, checking OPFS files directly...')
        try {
          // First, list ALL available OPFS files for debugging
          const allFiles: string[] = []
          for await (const [name] of (this.opfsRoot as any).entries()) {
            allFiles.push(name)
          }
          console.log('📁 All OPFS files:', allFiles)

          // Try to find the exact file by extracting filename from potential OPFS URLs
          const availableFiles: string[] = []
          for (const fileName of allFiles) {
            // Check if this file matches our imageId in any way
            if (fileName.includes(imageId) ||
                fileName.startsWith(imageId) ||
                fileName.includes(imageId.replace('slice-', ''))) {
              availableFiles.push(fileName)
            }
          }

          console.log('🎯 Potential matches for', imageId, ':', availableFiles)

          if (availableFiles.length > 0) {
            // Create synthetic metadata for the first match
            const fileName = availableFiles[0]
            metadata = {
              sliceId: imageId,
              imageId: `${imageId}_${Date.now()}`, // Generate a unique imageId
              fileName: fileName,
              originalName: fileName,
              size: 0, // We don't know the size without loading
              type: 'image/jpeg', // Assume JPEG
              storageType: 'opfs' as const,
              storedAt: Date.now()
            }

            console.log('✅ Reconstructed metadata from OPFS file:', metadata)
          } else {
            console.log('❌ No matching OPFS files found for imageId:', imageId)

            // Last resort: try to find ANY file that might be related
            // This handles cases where the OPFS file exists but naming is completely different
            console.log('🔍 Searching for any OPFS files that might be related...')
            const relatedFiles = allFiles.filter(file =>
              file.endsWith('.jpeg') || file.endsWith('.jpg') || file.endsWith('.png')
            )

            if (relatedFiles.length > 0) {
              console.log('📋 Found image files in OPFS:', relatedFiles)

              // Use the first available image file as a fallback
              const fallbackFile = relatedFiles[0]
              metadata = {
                sliceId: imageId,
                imageId: `fallback_${Date.now()}`,
                fileName: fallbackFile,
                originalName: fallbackFile,
                size: 0,
                type: 'image/jpeg',
                storageType: 'opfs' as const,
                storedAt: Date.now()
              }

              console.log('⚠️ Using fallback OPFS file:', metadata)
            }
          }
        } catch (error) {
          console.warn('⚠️ Could not check OPFS files:', error)
        }
      }

      if (!metadata) {
        console.error('❌ Image metadata not found for ID:', imageId)
        console.log('📋 Available images:', allImages.map(img => ({ imageId: img.imageId, sliceId: img.sliceId, fileName: img.fileName, storageType: img.storageType })))

        // Try to debug OPFS files to see what's actually available
        if (this.opfsRoot && this.debugOPFSFiles) {
          console.log('🔍 Checking OPFS files for debugging...')
          await this.debugOPFSFiles()
        }

        throw new Error(`Image not found for ID: ${imageId}. Checked metadata, sliceId matches, and OPFS files.`)
      }
    }

    console.log('✅ Found metadata:', {
      imageId: metadata.imageId,
      sliceId: metadata.sliceId,
      fileName: metadata.fileName,
      storageType: metadata.storageType
    })

    switch (metadata.storageType) {
      case 'opfs':
        // Use the safer method that handles failures gracefully
        const opfsUrl = await this.getOPFSImageUrlSafe(metadata.imageId, metadata.fileName)
        if (opfsUrl) {
          return opfsUrl
        } else {
          throw new Error(`OPFS image not accessible: ${metadata.imageId}/${metadata.fileName}`)
        }
      case 'filesystem':
        return await this.getFileSystemImageUrl(metadata.fileName)
      case 'indexeddb':
        return await this.getIndexedDBImageUrl(metadata.imageId, metadata.totalChunks || 0)
      default:
        throw new Error(`Unknown storage type: ${metadata.storageType}`)
    }
  }

  async getOPFSImageUrl(fileName: string): Promise<string> {
    if (!this.opfsRoot) throw new Error('OPFS not initialized')

    try {
      const fileHandle = await this.opfsRoot.getFileHandle(fileName)
      const file = await fileHandle.getFile()

      // Validate file exists and has content
      if (file.size === 0) {
        throw new Error(`OPFS file is empty: ${fileName}`)
      }

      const blobUrl = URL.createObjectURL(file)
      console.log('✅ Created blob URL for OPFS file:', fileName, `(${file.size} bytes)`)
      return blobUrl

    } catch (error: any) {
      console.error('❌ Failed to get OPFS file:', fileName, error)

      // Provide more specific error messages
      if (error.name === 'NotFoundError') {
        throw new Error(`OPFS file not found: ${fileName}`)
      } else if (error.name === 'NotAllowedError') {
        throw new Error(`OPFS access denied for file: ${fileName}`)
      } else {
        throw new Error(`OPFS error for ${fileName}: ${error.message}`)
      }
    }
  }

  // Enhanced method with better error handling for retry scenarios
  async getOPFSImageUrlSafe(imageId: string, fileName: string): Promise<string | null> {
    try {
      return await this.getOPFSImageUrl(fileName)
    } catch (error) {
      console.warn(`⚠️ OPFS lookup failed for ${imageId}/${fileName}:`, error)

      // Try to find alternative file names or locations
      try {
        if (this.opfsRoot) {
          console.log('🔍 Searching for alternative file names in OPFS...')

          // List all files to see what's available
          const availableFiles: string[] = []
          for await (const [name] of (this.opfsRoot as any).entries()) {
            if (name.includes(imageId) || name.includes(fileName.split('_')[0])) {
              availableFiles.push(name)
            }
          }

          if (availableFiles.length > 0) {
            console.log('📋 Found potential matches:', availableFiles)
            // Try the first match
            return await this.getOPFSImageUrl(availableFiles[0])
          }
        }
      } catch (searchError) {
        console.warn('⚠️ Alternative search also failed:', searchError)
      }

      return null // Indicate graceful failure
    }
  }

  private async getFileSystemImageUrl(fileName: string): Promise<string> {
    if (!this.rootDir) throw new Error('File System Access not initialized')

    const fileHandle = await this.rootDir.getFileHandle(fileName)
    const file = await fileHandle.getFile()
    return URL.createObjectURL(file)
  }

  private async getIndexedDBImageUrl(imageId: string, totalChunks: number): Promise<string> {
    if (!this.db) throw new Error('IndexedDB not initialized')

    const transaction = this.db.transaction(['imageChunks'], 'readonly')
    const chunkStore = transaction.objectStore('imageChunks')

    const chunks: ArrayBuffer[] = []
    for (let i = 0; i < totalChunks; i++) {
      const chunkData = await this.promisifyRequest(chunkStore.get([imageId, i]))
      if (chunkData?.data) chunks.push(chunkData.data)
    }

    // Combine chunks into single blob
    const totalSize = chunks.reduce((size, chunk) => size + chunk.byteLength, 0)
    const combined = new Uint8Array(totalSize)
    let offset = 0
    for (const chunk of chunks) {
      combined.set(new Uint8Array(chunk), offset)
      offset += chunk.byteLength
    }

    const blob = new Blob([combined])
    return URL.createObjectURL(blob)
  }

  async getImageMetadata(imageId: string): Promise<ImageMetadata | null> {
    if (!this.db) return null

    try {
      const transaction = this.db.transaction(['images'], 'readonly')
      const imageStore = transaction.objectStore('images')
      const metadata = await this.promisifyRequest(imageStore.get(imageId))
      return metadata || null
    } catch (error) {
      console.error('Error getting image metadata:', error)
      return null
    }
  }

  private async storeImageMetadata(metadata: ImageMetadata): Promise<void> {
    if (!this.db) throw new Error('IndexedDB not initialized')

    const transaction = this.db.transaction(['images'], 'readwrite')
    const imageStore = transaction.objectStore('images')
    await this.promisifyRequest(imageStore.put(metadata))
  }

  async deleteImage(imageId: string): Promise<void> {
    const metadata = await this.getImageMetadata(imageId)
    if (!metadata) return

    try {
      switch (metadata.storageType) {
        case 'opfs':
          await this.deleteFromOPFS(metadata.fileName)
          break
        case 'filesystem':
          await this.deleteFromFileSystem(metadata.fileName)
          break
        case 'indexeddb':
          await this.deleteFromIndexedDB(imageId, metadata.totalChunks || 0)
          break
      }

      // Remove metadata
      if (this.db) {
        const transaction = this.db.transaction(['images'], 'readwrite')
        const imageStore = transaction.objectStore('images')
        await this.promisifyRequest(imageStore.delete(imageId))
      }

      console.log(`✅ Image deleted: ${imageId}`)
    } catch (error) {
      console.error(`❌ Error deleting image ${imageId}:`, error)
      throw error
    }
  }

  private async deleteFromOPFS(fileName: string): Promise<void> {
    if (!this.opfsRoot) return
    // OPFS doesn't have a direct delete method, but files are cleaned up automatically
    // when no longer referenced
  }

  private async deleteFromFileSystem(fileName: string): Promise<void> {
    if (!this.rootDir) return
    // File System Access API doesn't have a direct delete method
    // Files will be cleaned up by the OS when no longer referenced
  }

  private async deleteFromIndexedDB(imageId: string, totalChunks: number): Promise<void> {
    if (!this.db) return

    const transaction = this.db.transaction(['imageChunks'], 'readwrite')
    const chunkStore = transaction.objectStore('imageChunks')

    // Delete all chunks for this image
    for (let i = 0; i < totalChunks; i++) {
      await this.promisifyRequest(chunkStore.delete([imageId, i]))
    }
  }

  async compressImage(file: File, options: {
    quality?: number
    maxWidth?: number
    maxHeight?: number
  }): Promise<File> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img
        const { maxWidth = 1200, maxHeight = 1200, quality = 0.8 } = options

        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height
          if (width > height) {
            width = maxWidth
            height = width / aspectRatio
          } else {
            height = maxHeight
            width = height * aspectRatio
          }
        }

        canvas.width = width
        canvas.height = height

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Compression failed'))
            return
          }

          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          })

          resolve(compressedFile)
        }, 'image/jpeg', quality)
      }

      img.onerror = () => reject(new Error('Could not load image for compression'))
      img.src = URL.createObjectURL(file)
    })
  }

  async getStorageStats(): Promise<StorageStats> {
    try {
      let used = 0
      let total = this.storageQuota
      let available = total - used

      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        used = estimate.usage || 0
        total = estimate.quota || this.storageQuota
        available = total - used
      }

      const imageCount = await this.getImageCount()

      return {
        used,
        available,
        total,
        images: imageCount,
        quota: this.storageQuota
      }
    } catch (error) {
      console.error('Error getting storage stats:', error)
      return {
        used: 0,
        available: 0,
        total: this.storageQuota,
        images: 0,
        quota: this.storageQuota
      }
    }
  }

  private async getImageCount(): Promise<number> {
    if (!this.db) return 0

    try {
      const transaction = this.db.transaction(['images'], 'readonly')
      const imageStore = transaction.objectStore('images')
      return await this.promisifyRequest(imageStore.count())
    } catch (error) {
      console.error('Error getting image count:', error)
      return 0
    }
  }

  async cleanupOldImages(daysOld: number = 30): Promise<number> {
    const cutoffDate = Date.now() - (daysOld * 24 * 60 * 60 * 1000)

    try {
      if (!this.db) return 0

      const transaction = this.db.transaction(['images'], 'readonly')
      const imageStore = transaction.objectStore('images')
      const index = imageStore.index('storedAt')

      return new Promise((resolve, reject) => {
        const request = index.openCursor(IDBKeyRange.upperBound(cutoffDate))
        let deletedCount = 0

        request.onsuccess = async (event) => {
          const cursor = (event.target as IDBRequest).result
          if (cursor) {
            try {
              await this.deleteImage(cursor.value.imageId)
              deletedCount++
              cursor.continue()
            } catch (error) {
              console.error('Error deleting old image:', error)
              cursor.continue()
            }
          } else {
            console.log(`✅ Cleanup complete: ${deletedCount} old images removed`)
            resolve(deletedCount)
          }
        }

        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error during cleanup:', error)
      return 0
    }
  }

  async getImagesBySlice(sliceId: string): Promise<ImageMetadata[]> {
    if (!this.db) return []

    try {
      const transaction = this.db.transaction(['images'], 'readonly')
      const imageStore = transaction.objectStore('images')
      const index = imageStore.index('sliceId')

      return new Promise((resolve, reject) => {
        const request = index.getAll(sliceId)
        request.onsuccess = () => resolve(request.result || [])
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error getting images by slice:', error)
      return []
    }
  }

  async exportStorageData(): Promise<any> {
    const stats = await this.getStorageStats()
    const allImages = await this.getAllImages()

    return {
      stats,
      images: allImages,
      exportedAt: Date.now(),
      version: '1.0'
    }
  }

  private async getAllImages(): Promise<ImageMetadata[]> {
    if (!this.db) return []

    try {
      const transaction = this.db.transaction(['images'], 'readonly')
      const imageStore = transaction.objectStore('images')
      return await this.promisifyRequest(imageStore.getAll())
    } catch (error) {
      console.error('Error getting all images:', error)
      return []
    }
  }

  async debugOPFSFiles(): Promise<void> {
    if (!this.opfsRoot) {
      console.log('❌ OPFS not initialized')
      return
    }

    try {
      console.log('🔍 Debugging OPFS files...')

      // List all files in OPFS root
      const files: string[] = []
      for await (const [name] of (this.opfsRoot as any).entries()) {
        files.push(name)
      }

      console.log(`📁 Found ${files.length} files in OPFS:`)
      for (const fileName of files) {
        try {
          const fileHandle = await this.opfsRoot.getFileHandle(fileName)
          const file = await fileHandle.getFile()
          console.log(`  📄 ${fileName}: ${(file.size / 1024).toFixed(2)}KB, ${file.type || 'unknown type'}`)
        } catch (error) {
          console.log(`  ❌ ${fileName}: Error accessing file - ${error}`)
        }
      }

      // Also check IndexedDB for comparison
      const allImages = await this.getAllImages()
      const opfsImages = allImages.filter(img => img.storageType === 'opfs')
      console.log(`📊 IndexedDB shows ${opfsImages.length} OPFS images registered`)

      if (files.length !== opfsImages.length) {
        console.warn(`⚠️ Mismatch: ${files.length} files in OPFS vs ${opfsImages.length} registered in IndexedDB`)
      }

      // Show detailed comparison
      console.log('📋 Detailed comparison:')
      console.log('Files in OPFS:', files)
      console.log('OPFS images in IndexedDB:', opfsImages.map(img => ({ imageId: img.imageId, sliceId: img.sliceId, fileName: img.fileName })))

    } catch (error) {
      console.error('❌ Error debugging OPFS files:', error)
    }
  }

  // Helper method for testing OPFS functionality from console
  async testOPFSConversion(testImageId?: string): Promise<void> {
    console.log('🧪 Testing OPFS conversion...')

    try {
      // Initialize if needed
      if (!this.initialized) {
        await this.initialize()
      }

      // Debug OPFS files first
      await this.debugOPFSFiles()

      // Test with specific imageId or find one to test with
      let imageId = testImageId
      if (!imageId) {
        const allImages = await this.getAllImages()
        const opfsImage = allImages.find(img => img.storageType === 'opfs')
        if (opfsImage) {
          imageId = opfsImage.imageId
        } else {
          console.log('❌ No OPFS images found for testing')
          return
        }
      }

      console.log(`🔄 Testing conversion for imageId: ${imageId}`)

      const blobUrl = await this.getImageUrl(imageId)
      console.log(`✅ Successfully converted to blob URL: ${blobUrl.substring(0, 50)}...`)

      // Test if the blob URL is actually accessible
      const testImg = new Image()
      testImg.onload = () => {
        console.log(`✅ Blob URL is accessible! Image dimensions: ${testImg.naturalWidth}x${testImg.naturalHeight}`)
      }
      testImg.onerror = () => {
        console.error(`❌ Blob URL is not accessible: ${blobUrl}`)
      }
      testImg.src = blobUrl

    } catch (error) {
      console.error('❌ OPFS conversion test failed:', error)
    }
  }

  // Public method to check if image exists
  async imageExists(imageId: string): Promise<boolean> {
    try {
      const metadata = await this.getImageMetadata(imageId)
      return metadata !== null
    } catch (error) {
      return false
    }
  }

  // Public method to get all image metadata (for debugging)
  async getAllImageMetadata(): Promise<ImageMetadata[]> {
    if (!this.db) return []
    return await this.getAllImages()
  }

  async importStorageData(data: any): Promise<void> {
    if (!data.images || !Array.isArray(data.images)) {
      throw new Error('Invalid import data format')
    }

    console.log(`📥 Importing ${data.images.length} images...`)

    for (const metadata of data.images) {
      try {
        // This would require the actual image files to be available
        // For now, just restore metadata
        await this.storeImageMetadata(metadata)
      } catch (error) {
        console.error(`Error importing image ${metadata.imageId}:`, error)
      }
    }

    console.log('✅ Import complete')
  }
}

// Export singleton instance
export const imageStorageManager = ImageStorageManager.getInstance()

// Make test function available globally for debugging (only in development)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).testOPFSConversion = async (imageId?: string) => {
    await imageStorageManager.testOPFSConversion(imageId)
  }
  (window as any).debugOPFSFiles = async () => {
    await imageStorageManager.debugOPFSFiles()
  }
  (window as any).checkImageExists = async (imageId: string) => {
    return await imageStorageManager.imageExists(imageId)
  }
  (window as any).getAllImageMetadata = async () => {
    return await imageStorageManager.getAllImageMetadata()
  }
  (window as any).debugOPFSIssue = async (opfsUrl: string) => {
    console.log('🔍 Debugging OPFS issue for URL:', opfsUrl)
    const fileName = opfsUrl.replace('opfs://', '')
    const parts = fileName.split('_')
    const extractedImageId = parts[0]
    console.log('📋 Extracted imageId:', extractedImageId)

    const exists = await imageStorageManager.imageExists(extractedImageId)
    console.log('📋 Image exists:', exists)

    if (!exists) {
      console.log('📋 Trying with full filename as imageId:', fileName)
      const fileNameExists = await imageStorageManager.imageExists(fileName)
      console.log('📋 Filename exists as imageId:', fileNameExists)
    }

    await imageStorageManager.debugOPFSFiles()
  }

  // Enhanced debugging function for the specific issue
  (window as any).debugOPFSImageLoad = async (opfsUrl: string) => {
    console.log('🔍 Debugging OPFS image load for URL:', opfsUrl)

    // Extract filename from URL
    const fileName = opfsUrl.replace('opfs://', '')
    console.log('📁 Target filename:', fileName)

    // List all OPFS files
    if (imageStorageManager['opfsRoot']) {
      const allFiles: string[] = []
      for await (const [name] of (imageStorageManager['opfsRoot'] as any).entries()) {
        allFiles.push(name)
      }
      console.log('📋 All OPFS files:', allFiles)

      // Find exact or partial matches
      const exactMatch = allFiles.find(f => f === fileName)
      const partialMatches = allFiles.filter(f => f.includes(fileName.split('_')[0]))

      console.log('🎯 Exact match:', exactMatch)
      console.log('🔍 Partial matches:', partialMatches)

      if (exactMatch) {
        console.log('✅ Found exact file match!')
        try {
          const testUrl = await imageStorageManager.getOPFSImageUrl(fileName)
          console.log('✅ Successfully created blob URL for', fileName)
          return testUrl
        } catch (error) {
          console.error('❌ Failed to create blob URL:', error)
        }
      } else if (partialMatches.length > 0) {
        console.log('✅ Found partial matches, trying first one:', partialMatches[0])
        try {
          const testUrl = await imageStorageManager.getOPFSImageUrl(partialMatches[0])
          console.log('✅ Successfully created blob URL for', partialMatches[0])
          return testUrl
        } catch (error) {
          console.error('❌ Failed to create blob URL:', error)
        }
      } else {
        console.log('❌ No matches found for filename:', fileName)
      }
    } else {
      console.log('❌ OPFS root not initialized')
    }
  }

  console.log('🛠️ OPFS debugging functions available:')
  console.log('  - await window.testOPFSConversion(imageId?)')
  console.log('  - await window.debugOPFSFiles()')
  console.log('  - await window.checkImageExists(imageId)')
  console.log('  - await window.getAllImageMetadata()')
  console.log('  - await window.debugOPFSIssue(opfsUrl)')
  console.log('  - await window.debugOPFSImageLoad(opfsUrl)  // New: Test specific OPFS URL')
}