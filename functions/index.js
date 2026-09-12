const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const messaging = admin.messaging();

/**
 * Triggered strictly when a brand new wallpaper document is created in /wallpapers/{wallpaperId}.
 * Strictly ignores updates, featured toggles, category changes, or deletions.
 */
exports.sendNewWallpaperNotification = onDocumentCreated(
  {
    document: "wallpapers/{wallpaperId}",
    region: "us-central1"
  },
  async (event) => {
    const snap = event.data;
    if (!snap) {
      console.log("No data associated with the event");
      return;
    }

    const wallpaperId = event.params.wallpaperId;
    const wallpaper = snap.data();

    if (!wallpaper || !wallpaper.imageUrl) {
      console.log("Skipping notification: Wallpaper doc missing or lacks imageUrl", wallpaperId);
      return;
    }

    // Idempotency Check via events collection
    const eventRef = db.collection("events").document(`NEW_WALLPAPER_${wallpaperId}`);
    const eventDoc = await eventRef.get();
    if (eventDoc.exists) {
      console.log(`Notification for wallpaper ${wallpaperId} was already dispatched. Skipping.`);
      return;
    }

    // Reserve event key immediately to prevent duplicate runs
    await eventRef.set({
      wallpaperId,
      status: "processing",
      initiatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const category = wallpaper.category || "General";
    const title = `New ${category} Wallpaper!`;
    const body = wallpaper.title
      ? `Check out "${wallpaper.title}" in ${category}.`
      : `Discover the newest wallpaper added to ${category}!`;
    const imageUrl = wallpaper.imageUrl;

    try {
      // 1. Fetch all users
      const usersSnap = await db.collection("users").get();
      if (usersSnap.empty) {
        console.log("No users found to notify.");
        await eventRef.update({ status: "completed", totalUsers: 0 });
        return;
      }

      const allTokens = [];
      const tokenDocRefs = [];
      const inAppNotificationPromises = [];

      for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data() || {};
        const uid = userDoc.id;

        // Check user notification preference (defaults to true if unset)
        const settings = userData.notificationSettings || {};
        if (settings.newWallpapers === false) {
          continue;
        }

        // Write in-app notification to users/{uid}/notifications
        const notifRef = db.collection("users").doc(uid).collection("notifications").doc();
        inAppNotificationPromises.push(
          notifRef.set({
            title,
            body,
            imageUrl,
            wallpaperId,
            category,
            type: "NEW_WALLPAPER",
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          }).catch((err) => {
            console.error(`Failed to write in-app notification for user ${uid}:`, err);
          })
        );

        // Fetch user FCM device tokens
        const tokensSnap = await db.collection("users").doc(uid).collection("fcmTokens").get();
        tokensSnap.forEach((tDoc) => {
          const tData = tDoc.data();
          const token = tData?.token || tDoc.id;
          if (token && typeof token === "string" && token.length > 10) {
            allTokens.push(token);
            tokenDocRefs.push({
              ref: tDoc.ref,
              token
            });
          }
        });
      }

      // Concurrently persist all in-app notifications
      await Promise.all(inAppNotificationPromises);

      // 2. Dispatch FCM Multicast if tokens exist
      let deliveredCount = 0;
      let failedCount = 0;

      if (allTokens.length > 0) {
        // Chunk tokens into batches of 500 (FCM multicast limit)
        const CHUNK_SIZE = 500;
        for (let i = 0; i < allTokens.length; i += CHUNK_SIZE) {
          const chunk = allTokens.slice(i, i + CHUNK_SIZE);
          const chunkRefs = tokenDocRefs.slice(i, i + CHUNK_SIZE);

          const message = {
            notification: {
              title,
              body,
              imageUrl
            },
            data: {
              type: "NEW_WALLPAPER",
              wallpaperId: String(wallpaperId),
              category: String(category),
              imageUrl: String(imageUrl),
              title: String(wallpaper.title || title)
            },
            tokens: chunk
          };

          const response = await messaging.sendEachForMulticast(message);
          deliveredCount += response.successCount;
          failedCount += response.failureCount;

          // Prune stale or unregistered tokens
          const deletionPromises = [];
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              const errorCode = resp.error?.code;
              if (
                errorCode === "messaging/registration-token-not-registered" ||
                errorCode === "messaging/invalid-registration-token"
              ) {
                deletionPromises.push(chunkRefs[idx].ref.delete().catch(() => {}));
              }
            }
          });

          if (deletionPromises.length > 0) {
            await Promise.all(deletionPromises);
          }
        }
      }

      await eventRef.set(
        {
          status: "completed",
          wallpaperId,
          deliveredTokensCount: deliveredCount,
          failedTokensCount: failedCount,
          totalInAppNotifs: inAppNotificationPromises.length,
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      console.log(
        `Successfully notified users for wallpaper ${wallpaperId}: delivered ${deliveredCount} push, ${inAppNotificationPromises.length} in-app.`
      );
    } catch (err) {
      console.error(`Error dispatching notifications for wallpaper ${wallpaperId}:`, err);
      await eventRef.set(
        {
          status: "error",
          error: err.message || String(err),
          failedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    }
  }
);
