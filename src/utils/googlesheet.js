import axios from 'axios';

const fetchGoogleSheetData = async () => {
  try {
    const sheetId = '1SIP3Glxo5vkL0Jvx9ulj0p6xZoOh0ruzRtIqzldmb8E';
    const apiKey = 'AIzaSyAGjWAyG29vKBgiYVSXCn08cu5ym6FwiQs';
    const range = 'catalogue tracker!A1:C';

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;
    const response = await axios.get(url);

    const data = response.data.values;

    // header remove
    const result = data.slice(1).map((row) => ({
      styleNumber: Number(row[0]) || '',
      checked: row[1] || '',
    }));

    return result;
  } catch (error) {
    console.log('Failed to fetch pattern and mrp data from google sheet error :: ', error);
    return [];
  }
};

export { fetchGoogleSheetData };
