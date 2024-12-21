import { initEdgeStore } from '@edgestore/server';
import { createEdgeStoreNextHandler } from '@edgestore/server/adapters/next/app';
import { edgeStoreRawSdk } from '@edgestore/server/core';
const es = initEdgeStore.create();

/**
 * This is the main router for the Edge Store buckets.
 */
const edgeStoreRouter = es.router({
  publicFiles: 
  es.fileBucket()
  
  .beforeDelete(({ ctx, fileInfo }) => {
    console.log('beforeDelete', ctx, fileInfo);
    // Get the current time and the file's upload timestamp
    const currentTime = new Date();
    console.log('Current TIME:', currentTime);
    const fileUploadTime = new Date(fileInfo.uploadedAt); // Assuming uploadedAt is a timestamp
    console.log('Upload TIME:', fileUploadTime);

    // Check if the file was uploaded more than 24 hours ago
    const timeDiff = currentTime.getTime() - fileUploadTime.getTime(); // .getTime() returns the timestamp in milliseconds
    const twentyFourHoursInMillis = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  
    if (timeDiff < twentyFourHoursInMillis) {
      console.log('File cannot be deleted yet. It was uploaded less than 24 hours ago.');
      return false; // Prevent deletion
    }
  
    console.log('File can be deleted. Proceeding...');
    return true; // Allow deletion if it's been more than 24 hours
  }),
});

const handler = createEdgeStoreNextHandler({
  router: edgeStoreRouter,
});

export { handler as GET, handler as POST };

/**
 * This type is used to create the type-safe client for the frontend.
 */
export type EdgeStoreRouter = typeof edgeStoreRouter;