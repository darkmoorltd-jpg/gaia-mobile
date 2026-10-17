import { Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export interface ReceiptOrder {
  id: string;
  order_ref: string;
  listing_title: string;
  quantity: number;
  total: number;
  status: string;
  payment_ref?: string;
  created_at: string;
  buyer_email?: string;
  seller_email?: string;
  buyer_name?: string;
  seller_name?: string;
  delivery_method?: string;
  delivery_fee?: number;
}

export async function generateAndShareReceipt(order: ReceiptOrder): Promise<{ uri: string | null; error: string | null }> {
  try {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const regular = await doc.embedFont(StandardFonts.Helvetica);

    const green = rgb(0, 0.85, 0.45);
    const dark = rgb(0.1, 0.12, 0.15);
    const grey = rgb(0.45, 0.45, 0.5);

    let y = 790;
    const left = 50;

    page.drawText('GAIA', { x: left, y, size: 32, font: bold, color: green });
    page.drawText('ESCROW RECEIPT', { x: left, y: y - 22, size: 11, font: bold, color: grey });
    page.drawText('Powered by Darkmoor Ltd', { x: left, y: y - 38, size: 9, font: regular, color: grey });

    y -= 80;
    page.drawLine({ start: { x: left, y }, end: { x: 545, y }, thickness: 1, color: green });

    y -= 30;
    const drawRow = (label: string, value: string) => {
      page.drawText(label, { x: left, y, size: 10, font: bold, color: grey });
      page.drawText(value, { x: left + 160, y, size: 11, font: regular, color: dark });
      y -= 22;
    };

    drawRow('Order ID', order.order_ref || order.id.slice(0, 12));
    drawRow('Status', (order.status || 'pending').toUpperCase());
    drawRow('Item', order.listing_title || '—');
    drawRow('Quantity', String(order.quantity || 0));
    drawRow('Total', 'NGN ' + Math.round(order.total || 0).toLocaleString());
    drawRow('Delivery', order.delivery_method || 'pickup');
    drawRow('Delivery fee', 'NGN ' + Math.round(order.delivery_fee || 0).toLocaleString());
    drawRow('Buyer', order.buyer_name || order.buyer_email || '—');
    drawRow('Seller', order.seller_name || order.seller_email || '—');
    drawRow('Created', new Date(order.created_at).toLocaleString());
    if (order.payment_ref) drawRow('Payment ref', order.payment_ref);

    y -= 20;
    page.drawLine({ start: { x: left, y }, end: { x: 545, y }, thickness: 1, color: grey });

    y -= 30;
    page.drawText('Escrow terms', { x: left, y, size: 12, font: bold, color: dark });
    y -= 18;
    const terms = [
      '- Funds are held in escrow until the buyer confirms delivery.',
      '- Disputes can be raised from the order screen within 7 days.',
      '- This receipt is proof of purchase and payment for this order.',
      '- All communication is logged in the order chat for your protection.',
    ];
    for (const line of terms) {
      page.drawText(line, { x: left, y, size: 10, font: regular, color: grey });
      y -= 16;
    }

    y -= 30;
    page.drawText('This receipt was generated automatically by GAIA.', { x: left, y, size: 9, font: regular, color: grey });
    y -= 12;
    page.drawText('For support, email darkmoorltd@gmail.com', { x: left, y, size: 9, font: regular, color: grey });

    const base64 = await doc.saveAsBase64();
    const dir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
    const safeRef = (order.order_ref || order.id).replace(/[^A-Za-z0-9_-]/g, '');
    const uri = dir + 'GAIA_receipt_' + safeRef + '.pdf';
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 } as any);

    let shared = false;
    try {
      const Sharing: any = await import('expo-sharing');
      if (Sharing && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share receipt' });
        shared = true;
      }
    } catch {}

    if (!shared) {
      if (Platform.OS === 'ios') {
        await Share.share({ url: uri, title: 'GAIA escrow receipt' });
      } else {
        const text = [
          'GAIA ESCROW RECEIPT',
          'Order: ' + order.order_ref,
          'Item: ' + order.listing_title,
          'Qty: ' + order.quantity,
          'Total: NGN ' + Math.round(order.total || 0).toLocaleString(),
          'Status: ' + (order.status || '').toUpperCase(),
          '',
          'PDF saved to: ' + uri,
        ].join('\n');
        await Share.share({ message: text });
      }
    }

    return { uri, error: null };
  } catch (e: any) {
    return { uri: null, error: e?.message || 'PDF generation failed' };
  }
}
