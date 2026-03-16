import { createCanvas, loadImage } from '@napi-rs/canvas';
import path from 'path';
import { fileURLToPath } from 'url';

// Define __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateClaimedImage(totalClaimed, walletLength, imagePath) {
    const canvas = createCanvas(1280, 720);
    const ctx = canvas.getContext('2d');
    const absoluteImagePath = path.join(__dirname, imagePath);
    const image = await loadImage(absoluteImagePath);

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Fixed position for the '-' character
    const dashX = 850;
    const dashY = 315;

    // Draw the '-' character at the fixed position
    ctx.font = 'bold 50px Arial';
    ctx.fillStyle = '#FFFFFF'; // White color
    const dashWidth = ctx.measureText('-').width;
    ctx.fillText('-', dashX, dashY);

    // Draw the total claimed text to the left of '-'
    ctx.fillStyle = '#00FF00'; // Green color
    let claimedText = totalClaimed.toFixed(4);
    claimedText = claimedText.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');

    if (claimedText.endsWith('.')) {
        claimedText = claimedText.slice(0, -1);
    }

    claimedText = `${claimedText} SOL`;
    const claimedTextWidth = ctx.measureText(claimedText).width;
    const claimedTextX = dashX - claimedTextWidth - 15; // Positioning to the left of '-'
    const claimedTextY = dashY;
    ctx.fillText(claimedText, claimedTextX, claimedTextY);

    // Draw the wallet length text to the right of '-'
    ctx.fillStyle = '#FFFFFF'; // White color
    const walletText = `${walletLength} Wallet${walletLength > 1 ? 's' : ''}`;
    const walletTextWidth = ctx.measureText(walletText).width;
    const walletTextX = dashX + dashWidth + 15; // Positioning to the right of '-'
    const walletTextY = dashY;
    ctx.fillText(walletText, walletTextX, walletTextY);

    return await canvas.encode('png');
}
