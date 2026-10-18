import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, ActivityIndicator, Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocale } from '../store/locale';
import { supabase } from '../api/supabase';

interface Props {
  visible: boolean;
  amount: number;
  email: string;
  reference: string;
  metadata?: Record<string, any>;
  onClose: () => void;
  onSuccess: (reference: string) => void;
}

export default function PaymentGateway({
  visible, amount, email, reference, metadata, onClose, onSuccess,
}: Props) {
  const provider = useLocale((s) => s.country.payment_provider);
  const currency = useLocale((s) => s.country.currency);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState(true);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      setLoadingKey(true);
      try {
        const { data } = await supabase
          .from('payment_providers')
          .select('public_key')
          .eq('provider_key', provider)
          .maybeSingle();
        setPublicKey(data?.public_key || null);
      } catch {}
      setLoadingKey(false);
    })();
  }, [visible, provider]);

  const html = buildPaymentHtml({
    provider, publicKey, amount, email, reference, currency, metadata,
  });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose}>
            <Text style={styles.close}>CANCEL</Text>
          </Pressable>
          <Text style={styles.title}>
            Pay {currency} {amount.toLocaleString()}
          </Text>
          <View style={{ width: 60 }} />
        </View>

        {loadingKey ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#00ff88" />
            <Text style={styles.loadingText}>Preparing checkout...</Text>
          </View>
        ) : !publicKey ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>
              Payment method for {provider} not configured yet.
              {'\n'}Please try again later.
            </Text>
          </View>
        ) : (
          <WebView
            source={{ html }}
            style={{ flex: 1 }}
            javaScriptEnabled
            domStorageEnabled
            onMessage={(e) => {
              try {
                const msg = JSON.parse(e.nativeEvent.data);
                if (msg.status === 'success') onSuccess(msg.reference || reference);
                else if (msg.status === 'closed') onClose();
              } catch {}
            }}
          />
        )}
      </View>
    </Modal>
  );
}

function buildPaymentHtml(opts: any): string {
  const { provider, publicKey, amount, email, reference, currency, metadata } = opts;
  const meta = JSON.stringify(metadata || {});

  if (provider === 'paystack') {
    return `<!DOCTYPE html><html><head>
<script src="https://js.paystack.co/v1/inline.js"></script>
</head><body style="margin:0;background:#000;">
<script>
PaystackPop.setup({
  key: '${publicKey}', email: '${email}', amount: ${amount * 100},
  currency: '${currency}', ref: '${reference}', metadata: ${meta},
  callback: function(r) { window.ReactNativeWebView.postMessage(JSON.stringify({status:'success',reference:r.reference})); },
  onClose: function() { window.ReactNativeWebView.postMessage(JSON.stringify({status:'closed'})); }
}).openIframe();
</script></body></html>`;
  }

  if (provider === 'flutterwave') {
    return `<!DOCTYPE html><html><head>
<script src="https://checkout.flutterwave.com/v3.js"></script>
</head><body style="margin:0;background:#000;">
<script>
FlutterwaveCheckout({
  public_key: '${publicKey}', tx_ref: '${reference}', amount: ${amount},
  currency: '${currency}', payment_options: 'card,banktransfer,mobilemoney,ussd',
  customer: { email: '${email}' }, customizations: { title: 'GAIA', description: 'Purchase' },
  meta: ${meta},
  callback: function(r) {
    if (r.status === 'successful') window.ReactNativeWebView.postMessage(JSON.stringify({status:'success',reference:r.transaction_id}));
    else window.ReactNativeWebView.postMessage(JSON.stringify({status:'closed'}));
  },
  onclose: function() { window.ReactNativeWebView.postMessage(JSON.stringify({status:'closed'})); }
});
</script></body></html>`;
  }

  if (provider === 'stripe') {
    // Stripe Payment Links — user creates these in Stripe Dashboard and stores URL
    return `<!DOCTYPE html><html><body style="margin:0;">
<iframe src="https://buy.stripe.com/REPLACE_WITH_YOUR_PAYMENT_LINK?client_reference_id=${reference}" style="width:100%;height:100vh;border:0;"></iframe>
</body></html>`;
  }

  return `<!DOCTYPE html><html><body><p style="color:#fff;padding:20px;">Unsupported provider: ${provider}</p></body></html>`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#1e2d23',
  },
  close: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: '#6b7280', width: 60 },
  title: { fontSize: 15, fontWeight: '800', color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  loadingText: { color: '#94a3b8', marginTop: 14, fontSize: 13 },
  errorText: { color: '#ef4444', textAlign: 'center', fontSize: 14, lineHeight: 22 },
});
