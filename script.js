document.addEventListener('DOMContentLoaded', () => {
    const imageUpload = document.getElementById('imageUpload');
    const originalCanvas = document.getElementById('originalCanvas');
    const pixelArtCanvas = document.getElementById('pixelArtCanvas');
    const pixelSizeInput = document.getElementById('pixelSize');
    const pixelSizeValueSpan = document.getElementById('pixelSizeValue');
    const convertBtn = document.getElementById('convertBtn');
    const paletteSizeInput = document.getElementById('paletteSize');
    const paletteSizeValueSpan = document.getElementById('paletteSizeValue');
    const ditherCheckbox = document.getElementById('ditherEnabled');

    const originalCtx = originalCanvas.getContext('2d');
    const pixelArtCtx = pixelArtCanvas.getContext('2d');

    let uploadedImage = new Image();

    const MAX_CANVAS_WIDTH = 500;
    const MAX_CANVAS_HEIGHT = 500;

    // --- Helper for calculating color distance (Euclidean distance in RGB space) ---
    function colorDistance(r1, g1, b1, r2, g2, b2) {
        return Math.sqrt(
            Math.pow(r1 - r2, 2) +
            Math.pow(g1 - g2, 2) +
            Math.pow(b1 - b2, 2)
        );
    }

    // --- Finds the closest color in a given palette ---
    function findClosestColor(r, g, b, palette) {
        let closestColor = null;
        let minDistance = Infinity;

        for (const pColor of palette) {
            const dist = colorDistance(r, g, b, pColor.r, pColor.g, pColor.b);
            if (dist < minDistance) {
                minDistance = dist;
                closestColor = pColor;
            }
        }
        return closestColor;
    }

    // --- IMPROVED Palette generation using a simplified Median Cut approach ---
    function generatePalette(imageData, targetPaletteSize) {
        const data = imageData.data;
        const allPixels = []; // Store all sampled pixel colors as {r, g, b}

        // Sample colors - taking every Nth pixel for performance
        // Adjust sampleStep for more or less thorough sampling.
        // A larger step means faster palette generation but potentially less accurate for subtle colors.
        const sampleStep = 4;
        for (let i = 0; i < data.length; i += 4 * sampleStep) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            allPixels.push({ r, g, b });
        }

        // Recursive function to perform median cut
        function medianCut(pixels, k) {
            if (pixels.length === 0 || k === 0) {
                return [];
            }
            if (k === 1) {
                // If only one color is needed, average all pixels in this box
                let sumR = 0, sumG = 0, sumB = 0;
                for (const p of pixels) {
                    sumR += p.r;
                    sumG += p.g;
                    sumB += p.b;
                }
                return [{
                    r: Math.round(sumR / pixels.length),
                    g: Math.round(sumG / pixels.length),
                    b: Math.round(sumB / pixels.length)
                }];
            }

            // Find the color channel with the largest range
            let minR = 256, maxR = -1;
            let minG = 256, maxG = -1;
            let minB = 256, maxB = -1;

            for (const p of pixels) {
                minR = Math.min(minR, p.r); maxR = Math.max(maxR, p.r);
                minG = Math.min(minG, p.g); maxG = Math.max(maxG, p.g);
                minB = Math.min(minB, p.b); maxB = Math.max(maxB, p.b);
            }

            const rangeR = maxR - minR;
            const rangeG = maxG - minG;
            const rangeB = maxB - minB;

            let cutChannel;
            if (rangeR >= rangeG && rangeR >= rangeB) {
                cutChannel = 'r';
            } else if (rangeG >= rangeR && rangeG >= rangeB) {
                cutChannel = 'g';
            } else {
                cutChannel = 'b';
            }

            // Sort pixels by the chosen channel
            pixels.sort((a, b) => a[cutChannel] - b[cutChannel]);

            // Split into two halves
            const mid = Math.floor(pixels.length / 2);
            const half1 = pixels.slice(0, mid);
            const half2 = pixels.slice(mid);

            // Recursively call medianCut for each half
            const k1 = Math.ceil(k / 2);
            const k2 = Math.floor(k / 2);

            return [...medianCut(half1, k1), ...medianCut(half2, k2)];
        }

        // Call medianCut to generate the palette
        const generatedPalette = medianCut(allPixels, targetPaletteSize);
        return generatedPalette;
    }


    // Event listener for image upload
    imageUpload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                uploadedImage.onload = () => {
                    let newWidth = uploadedImage.width;
                    let newHeight = uploadedImage.height;

                    const aspectRatio = newWidth / newHeight;

                    // Scale down image to fit within MAX_CANVAS_WIDTH/HEIGHT while preserving aspect ratio
                    if (newWidth > MAX_CANVAS_WIDTH || newHeight > MAX_CANVAS_HEIGHT) {
                        if (newWidth / MAX_CANVAS_WIDTH > newHeight / MAX_CANVAS_HEIGHT) {
                            newWidth = MAX_CANVAS_WIDTH;
                            newHeight = MAX_CANVAS_WIDTH / aspectRatio;
                        } else {
                            newHeight = MAX_CANVAS_HEIGHT;
                            newWidth = MAX_CANVAS_HEIGHT * aspectRatio;
                        }
                    }

                    // Set canvas dimensions to the calculated new dimensions
                    originalCanvas.width = newWidth;
                    originalCanvas.height = newHeight;
                    pixelArtCanvas.width = newWidth;
                    pixelArtCanvas.height = newHeight;

                    // Draw the original image scaled to fit the new canvas size
                    originalCtx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
                    originalCtx.drawImage(uploadedImage, 0, 0, newWidth, newHeight);

                    // Automatically convert when a new image is loaded
                    convertToPixelArt();
                };
                uploadedImage.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // Event listener for pixel size slider
    pixelSizeInput.addEventListener('input', () => {
        pixelSizeValueSpan.textContent = pixelSizeInput.value;
        convertToPixelArt(); // Convert as slider changes
    });

    // Event listener for palette size slider
    paletteSizeInput.addEventListener('input', () => {
        paletteSizeValueSpan.textContent = paletteSizeInput.value;
        convertToPixelArt();
    });

    // Event listener for dither checkbox
    ditherCheckbox.addEventListener('change', () => {
        convertToPixelArt();
    });

    // Manual convert button (still useful)
    convertBtn.addEventListener('click', convertToPixelArt);

    function convertToPixelArt() {
        if (!uploadedImage.src || originalCanvas.width === 0 || originalCanvas.height === 0) {
            pixelArtCtx.clearRect(0, 0, pixelArtCanvas.width, pixelArtCanvas.height);
            return;
        }

        const pixelSize = parseInt(pixelSizeInput.value);
        const targetPaletteSize = parseInt(paletteSizeInput.value);
        const ditherEnabled = ditherCheckbox.checked;

        // Get the image data from the original canvas
        // We'll modify this data for pixelation, quantization, and dithering
        const imageData = originalCtx.getImageData(0, 0, originalCanvas.width, originalCanvas.height);
        // Make a copy of the pixel data to work on, as dithering modifies it in place
        const data = new Uint8ClampedArray(imageData.data);

        const width = originalCanvas.width;
        const height = originalCanvas.height;

        // --- Step 1: Generate the color palette ---
        // This is done once per conversion based on the original image data.
        const palette = generatePalette(imageData, targetPaletteSize);


        // --- Step 2: Apply Pixelation, Quantization, and Dithering ---
        // Clear the pixel art canvas before drawing
        pixelArtCtx.clearRect(0, 0, pixelArtCanvas.width, pixelArtCanvas.height);

        for (let y = 0; y < height; y += pixelSize) {
            for (let x = 0; x < width; x += pixelSize) {
                // Determine the average color for the current block
                let r_block_sum = 0, g_block_sum = 0, b_block_sum = 0, a_block_sum = 0;
                let pixelCount = 0;

                // Iterate through the actual pixels within this block to average their colors
                for (let dy = 0; dy < pixelSize && (y + dy) < height; dy++) {
                    for (let dx = 0; dx < pixelSize && (x + dx) < width; dx++) {
                        const currentPixelIndex = ((y + dy) * width + (x + dx)) * 4;
                        // Use the 'data' array (which might have error propagated) for averaging
                        r_block_sum += data[currentPixelIndex];
                        g_block_sum += data[currentPixelIndex + 1];
                        b_block_sum += data[currentPixelIndex + 2];
                        a_block_sum += data[currentPixelIndex + 3];
                        pixelCount++;
                    }
                }

                // Calculate the average color of the block
                const originalR = Math.round(r_block_sum / pixelCount);
                const originalG = Math.round(g_block_sum / pixelCount);
                const originalB = Math.round(b_block_sum / pixelCount);
                const originalA = Math.round(a_block_sum / pixelCount);


                // Find the closest color in the generated palette
                const paletteColor = findClosestColor(originalR, originalG, originalB, palette);

                let finalR = paletteColor.r;
                let finalG = paletteColor.g;
                let finalB = paletteColor.b;

                // --- Dithering (Floyd-Steinberg) ---
                if (ditherEnabled) {
                    // Calculate the error between original and chosen palette color
                    const errorR = originalR - finalR;
                    const errorG = originalG - finalG;
                    const errorB = originalB - finalB;

                    // Distribute the error to neighboring pixels within the *original image data*
                    // for subsequent block calculations.
                    // This is applied to the individual pixels within the block and their neighbors.
                    // The values are clamped between 0 and 255.
                    for (let dy = 0; dy < pixelSize && (y + dy) < height; dy++) {
                        for (let dx = 0; dx < pixelSize && (x + dx) < width; dx++) {
                            const currentPxY = y + dy;
                            const currentPxX = x + dx;

                            // (x+1, y)
                            if (currentPxX + 1 < width) {
                                const idx = ((currentPxY) * width + (currentPxX + 1)) * 4;
                                data[idx]     = Math.max(0, Math.min(255, data[idx]     + errorR * 7 / 16));
                                data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + errorG * 7 / 16));
                                data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + errorB * 7 / 16));
                            }
                            // (x-1, y+1)
                            if (currentPxX - 1 >= 0 && currentPxY + 1 < height) {
                                const idx = ((currentPxY + 1) * width + (currentPxX - 1)) * 4;
                                data[idx]     = Math.max(0, Math.min(255, data[idx]     + errorR * 3 / 16));
                                data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + errorG * 3 / 16));
                                data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + errorB * 3 / 16));
                            }
                            // (x, y+1)
                            if (currentPxY + 1 < height) {
                                const idx = ((currentPxY + 1) * width + (currentPxX)) * 4;
                                data[idx]     = Math.max(0, Math.min(255, data[idx]     + errorR * 5 / 16));
                                data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + errorG * 5 / 16));
                                data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + errorB * 5 / 16));
                            }
                            // (x+1, y+1)
                            if (currentPxX + 1 < width && currentPxY + 1 < height) {
                                const idx = ((currentPxY + 1) * width + (currentPxX + 1)) * 4;
                                data[idx]     = Math.max(0, Math.min(255, data[idx]     + errorR * 1 / 16));
                                data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + errorG * 1 / 16));
                                data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + errorB * 1 / 16));
                            }
                        }
                    }
                }

                // Set the fill style for the current pixel art block using the chosen palette color
                pixelArtCtx.fillStyle = `rgba(${finalR}, ${finalG}, ${finalB}, ${originalA})`;

                // Draw the pixel art block
                pixelArtCtx.fillRect(x, y, pixelSize, pixelSize);
            }
        }
    }
});
