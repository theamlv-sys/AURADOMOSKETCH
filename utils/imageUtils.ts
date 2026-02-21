export const resizeImage = (base64Str: string, maxDimension: number = 1024): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxDimension) {
                    height *= maxDimension / width;
                    width = maxDimension;
                }
            } else {
                if (height > maxDimension) {
                    width *= maxDimension / height;
                    height = maxDimension;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas context not available'));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8)); // Use JPEG for better compression
        };
        img.onerror = reject;
        img.src = base64Str;
    });
};

export const cropToBase64AspectRatio = (base64Str: string, aspectRatio: "1:1" | "16:9" | "9:16" | "4:3" | "3:4"): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error('Canvas context not available'));
                return;
            }

            // Calculate target dimension ratio based on user selection
            let targetRatio = 1;
            switch (aspectRatio) {
                case '16:9': targetRatio = 16 / 9; break;
                case '9:16': targetRatio = 9 / 16; break;
                case '4:3': targetRatio = 4 / 3; break;
                case '3:4': targetRatio = 3 / 4; break;
                case '1:1': default: targetRatio = 1; break;
            }

            const imgRatio = img.width / img.height;
            let cropWidth = img.width;
            let cropHeight = img.height;
            let offsetX = 0;
            let offsetY = 0;

            // If image is wider than target ratio, crop the sides
            if (imgRatio > targetRatio) {
                cropWidth = img.height * targetRatio;
                offsetX = (img.width - cropWidth) / 2;
            }
            // If image is taller than target ratio, crop top/bottom
            else if (imgRatio < targetRatio) {
                cropHeight = img.width / targetRatio;
                offsetY = (img.height - cropHeight) / 2;
            }

            // Set canvas to the exact cropped dimensions
            canvas.width = cropWidth;
            canvas.height = cropHeight;

            // Draw the centered cropped portion onto the canvas
            ctx.drawImage(img, offsetX, offsetY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

            // Resolve as high-quality PNG
            resolve(canvas.toDataURL('image/png'));
        };

        // Ensure data string has prefix
        const safeBase64 = base64Str.startsWith('data:') ? base64Str : `data:image/png;base64,${base64Str}`;

        img.onerror = reject;
        img.src = safeBase64;
    });
};
