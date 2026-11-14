import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

export async function generateFarmPdf(base64Image: string, farmName: string) {
  try {
    // 1. Build the HTML wrapper for the PDF
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>GAIA Land Survey</title>
          <style>
            body {
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              background-color: #ffffff;
            }
            img {
              width: 100%;
              max-width: 800px;
              height: auto;
              object-fit: contain;
            }
          </style>
        </head>
        <body>
          <img src="data:image/jpeg;base64,${base64Image}" />
        </body>
      </html>
    `;

    // 2. Generate the PDF
    const { uri } = await Print.printToFileAsync({ html });

    // 3. Share the PDF
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share ${farmName} Survey`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      Alert.alert('PDF Saved', 'PDF generated successfully at: ' + uri);
    }

  } catch (error: any) {
    Alert.alert('PDF Error', error.message || 'Failed to generate PDF');
  }
}
