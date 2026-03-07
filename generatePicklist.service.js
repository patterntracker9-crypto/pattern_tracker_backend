import { chromium } from 'playwright';
import { ApiError } from '../../utils/ApiError.js';
import path from 'path';
import AdmZip from 'adm-zip';
import fs from 'fs';

const generatePicklist = async (channel) => {
  const channels = {
    ajio: 'checkbox46180',
    myntra: 'checkbox46241',
    nykaa: 'checkbox47950',
    tatacliq: 'checkbox46240',
    allchannel: 'filterOptionsSelectAll_channel_company_id',
  };
  const picklistBaseDir = path.join(process.cwd(), 'src', 'picklistFiles');
  const channels2 = [
    'ajio',
    'myntra',
    'nykaa',
    'tatacliq',
    'channelPdf',
    'extracted_orders_info',
    'rackspace',
  ];

  for (const channelName of channels2) {
    const channelFolderPath = path.join(picklistBaseDir, channelName);

    if (fs.existsSync(channelFolderPath)) {
      try {
        // Delete the entire channel folder and its contents
        fs.rmSync(channelFolderPath, { recursive: true, force: true });
      } catch (error) {
        console.log(`Error deleting channel folder ${channelName}:`, error.message);
      }
    }
  }

  if (!channel) {
    throw new ApiError(400, 'channel is required');
  }

  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = process.env.EMAIL;
  const password = process.env.PASSWORD;

  // Clean channel name
  const channelClean = channel.trim().toLowerCase();

  // *******************************************************************************************
  //   ********************** PART 1 OMS UNFULLFILL ORDERS DOWNLOAD ***********************
  // *******************************************************************************************

  await page.goto('https://client.omsguru.com/');
  await page.getByPlaceholder('Email Address').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();

  await page.goto('https://client.omsguru.com/orders/newOrders');
  await page.locator('#forceWarehouseSelector').selectOption('22784');

  await page.locator('[filter-field="channel_company_id"]').click();
  const popover = page.locator('#popoverchannel_company_id:visible');
  await popover.waitFor({ state: 'visible' });
  await popover.locator(`#${channels[channelClean]}`).click();
  await popover.locator('button.editable-submit').click();

  // ***********************************************************************************************
  // ***************************** PART 2 EXPORT PICKLIST ******************************************
  // ***********************************************************************************************

  const channelNameMapping = {
    myntra: 'Qurvii - Myntra PPMP',
    nykaa: 'Qurvii - Nykaa Fashion',
    ajio: 'Qurvii - Ajio Dropship',
    tatacliq: 'Qurvii - Tatacliq',
  };

  await page.goto('https://client.omsguru.com/picklists');

  // Create main picklistFiles directory if it doesn't exist
  // const picklistBaseDir = path.join(process.cwd(), 'src', 'picklistFiles');
  if (!fs.existsSync(picklistBaseDir)) {
    fs.mkdirSync(picklistBaseDir, { recursive: true });
  }

  // Create channel-specific folder without timestamp
  const channelFolder = path.join(picklistBaseDir, channelClean);

  // Delete existing channel folder if it exists (clean up old files)
  if (fs.existsSync(channelFolder)) {
    try {
      fs.rmSync(channelFolder, { recursive: true, force: true });
    } catch (error) {
      console.log(`Error cleaning up ${channelClean} folder:`, error.message);
    }
  }

  // Create fresh channel folder
  fs.mkdirSync(channelFolder, { recursive: true });

  // row jisme channel match kare
  const row = page
    .locator('tbody tr')
    .filter({ hasText: channelNameMapping[channelClean] })
    .first();

  // View Picklist
  await row.locator('a[title="View picklist Details"]').click();

  const [finalDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'CSV' }).click(),
  ]);

  const savePath = path.join(channelFolder, `${channelClean}_picklist.csv`);
  await finalDownload.saveAs(savePath);

  // ***********************************************************************************************
  // ***************************** PART 3 EXPORT PACKLOG ******************************************
  // ***********************************************************************************************

  await page.goto('https://client.omsguru.com/invoice_pack_logs');
  const row2 = page
    .locator('tbody tr')
    .filter({ hasText: channelNameMapping[channelClean] })
    .first();
  await row2.locator('a[title="View PackLog Details"]').click();

  page.on('dialog', async (dialog) => {
    console.log(dialog.message());
    await dialog.accept();
  });

  await page.getByRole('link', { name: 'Export Orders' }).click();
  await page.getByRole('link', { name: 'Export Orders' }).click();

  await page.locator('i.fa-bell').click();
  await page.waitForSelector('#ClientNotificationsList li.item');
  const exportLink = page
    .locator('#ClientNotificationsList li.item a[title="Click to download the exported orders"]')
    .first();

  const [download] = await Promise.all([page.waitForEvent('download'), exportLink.click()]);
  const zipPath = path.join(channelFolder, await download.suggestedFilename());
  await download.saveAs(zipPath);

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(channelFolder, true);

  // Find and rename the extracted CSV file
  const extractedFiles = fs.readdirSync(channelFolder);
  const csvFile = extractedFiles.find(
    (file) => file.endsWith('.csv') && !file.includes('picklist')
  );
  if (csvFile) {
    const finalFilePath = path.join(channelFolder, `${channelClean}_orders_info.csv`);
    if (fs.existsSync(finalFilePath)) fs.unlinkSync(finalFilePath);
    fs.renameSync(path.join(channelFolder, csvFile), finalFilePath);
  }

  // delete zip
  fs.unlinkSync(zipPath);

  // ***********************************************************************************************
  // ***************************** PART 4 EXPORT RACK SPACE DETAILS ********************************
  // ***********************************************************************************************

  await page.goto('https://client.omsguru.com/rack_spaces');
  await page.locator('#warehouseSelector').selectOption('22784');
  await page.getByRole('button', { name: 'Related Actions' }).click();

  await page.getByRole('link', { name: 'Export Rack Details' }).click();
  await page.locator('i.fa-bell').click();
  await page.waitForSelector('#ClientNotificationsList li.item');

  const exportLink2 = page
    .locator(
      '#ClientNotificationsList li.item a[title="Click here to download the rack space inventory export file"]'
    )
    .first();

  const [download2] = await Promise.all([page.waitForEvent('download'), exportLink2.click()]);
  const zipPath2 = path.join(channelFolder, await download2.suggestedFilename());
  await download2.saveAs(zipPath2);

  const zip2 = new AdmZip(zipPath2);
  zip2.extractAllTo(channelFolder, true);

  // Find and rename rack space CSV
  const extractedFiles2 = fs.readdirSync(channelFolder);
  const csvFile2 = extractedFiles2.find((file) => file.endsWith('.csv') && file.includes('rack'));
  if (csvFile2) {
    const finalFilePath2 = path.join(channelFolder, `${channelClean}_rack_space.csv`);
    if (fs.existsSync(finalFilePath2)) fs.unlinkSync(finalFilePath2);
    fs.renameSync(path.join(channelFolder, csvFile2), finalFilePath2);
  }

  // delete zip
  fs.unlinkSync(zipPath2);

  // ***********************************************************************************************
  // ***************************** PART 5 PICKLIST SYNCRONIZATION **********************************
  // ***********************************************************************************************

  const orders_info_file_path = path.join(channelFolder, `${channelClean}_orders_info.csv`);
  const picklist_file_path = path.join(channelFolder, `${channelClean}_picklist.csv`);
  const rackspace_file_path = path.join(channelFolder, `${channelClean}_rack_space.csv`);

  // Verify files exist before proceeding
  if (!fs.existsSync(orders_info_file_path)) {
    throw new ApiError(500, `Orders info file not found for ${channelClean}`);
  }
  if (!fs.existsSync(picklist_file_path)) {
    throw new ApiError(500, `Picklist file not found for ${channelClean}`);
  }
  if (!fs.existsSync(rackspace_file_path)) {
    throw new ApiError(500, `Rack space file not found for ${channelClean}`);
  }

  await page.goto('https://scanreturn3.netlify.app/uploads');
  const formattedChannel = channelClean.charAt(0).toUpperCase() + channelClean.slice(1);
  await page.waitForTimeout(3000);
  await page.waitForLoadState();
  await page.locator('select').selectOption(formattedChannel);

  // Wait 1 second before first file upload
  await page.waitForTimeout(1000);

  // Upload first file (orders_info)
  await page.locator('#file-upload').setInputFiles(orders_info_file_path);

  // Wait 1 second before second file upload
  await page.waitForTimeout(1000);

  // Upload second file (picklist)
  await page.locator('#rack-space-upload').nth(0).setInputFiles(picklist_file_path);

  // Wait 1 second before third file upload
  await page.waitForTimeout(1000);

  // Upload third file (rack_space)
  await page.locator('#rack-space-upload').nth(1).setInputFiles(rackspace_file_path);

  // Optional: Wait an additional second after all uploads are complete
  await page.waitForTimeout(1000);

  // sync orders
  // await page.getByRole('button', { name: 'Sync Orders to NocoDB' }).click();

  // Create channel-specific pdf folder
  const pdfFolder = path.join(picklistBaseDir, 'channelPdf');
  if (!fs.existsSync(pdfFolder)) {
    fs.mkdirSync(pdfFolder, { recursive: true });
  }

  // Create a temporary file with timestamp first to ensure it's new
  const tempPdfPath = path.join(pdfFolder, `${channelClean}_picklist_${Date.now()}.pdf`);
  const finalPdfPath = path.join(pdfFolder, `${channelClean}_picklist.pdf`);

  // Download to temp file first
  const [download_picklist] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export Picklist' }).click(),
  ]);

  await download_picklist.saveAs(tempPdfPath);

  // Verify the temp file was created and has content
  if (!fs.existsSync(tempPdfPath) || fs.statSync(tempPdfPath).size === 0) {
    throw new ApiError(500, `Failed to download PDF for ${channelClean}`);
  }

  // Delete old PDF if it exists
  if (fs.existsSync(finalPdfPath)) {
    try {
      fs.unlinkSync(finalPdfPath);
      console.log(`Deleted old PDF for ${channelClean}`);
    } catch (error) {
      console.log(`Error deleting old PDF for ${channelClean}:`, error.message);
    }
  }

  // Rename temp file to final name
  fs.renameSync(tempPdfPath, finalPdfPath);

  // Final verification
  if (!fs.existsSync(finalPdfPath)) {
    throw new ApiError(500, `PDF file not found at ${finalPdfPath} after save`);
  }
  await browser.close();
  return {
    fileData: finalPdfPath,
    message: `Picklist generated successfully for ${channelClean}`,
    channel: channelClean,
  };
};

export { generatePicklist };
