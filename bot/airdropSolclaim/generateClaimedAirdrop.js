import { createCanvas, loadImage } from '@napi-rs/canvas';
import path from 'path';
import { fileURLToPath } from 'url';

// Define __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateClaimedAirdrop(totalClaimed, imagePath) {
    const canvas = createCanvas(1280, 720);
    const ctx = canvas.getContext('2d');
    const absoluteImagePath = path.join(__dirname, imagePath);
    const image = await loadImage(absoluteImagePath);

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Draw the total claimed text
    ctx.font = 'bold 50px Arial';
    ctx.fillStyle = '#00FF00'; // Green color
    const claimedText = `${totalClaimed} $SCLAIM`;
    const claimedTextWidth = ctx.measureText(claimedText).width;
    const claimedTextX = 850 - (claimedTextWidth / 2); // Centered horizontally
    const claimedTextY = 315;
    ctx.fillText(claimedText, claimedTextX, claimedTextY);

    return await canvas.encode('png');
}
