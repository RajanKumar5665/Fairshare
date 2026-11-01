/**
 * Razorpay SDK Loader & Checkout Helper
 */

export function loadRazorpaySDK() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Open Razorpay Checkout modal with prefilled user and order data
 */
export async function openRazorpaySubscriptionCheckout({
  orderData,
  user,
  onSuccess,
  onError,
  onDismiss,
}) {
  if (orderData.isMock) {
    const mockResponse = {
      razorpay_order_id: orderData.orderId,
      razorpay_payment_id: `pay_mock_${Date.now()}`,
      razorpay_signature: `sig_mock_${Date.now()}`,
    };
    if (onSuccess) {
      setTimeout(() => onSuccess(mockResponse), 400);
    }
    return;
  }

  if (!orderData.keyId || orderData.keyId.includes('placeholder')) {
    throw new Error('Razorpay keys are not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env to complete payment.');
  }

  const loaded = await loadRazorpaySDK();
  if (!loaded || !window.Razorpay) {
    throw new Error('Razorpay checkout SDK could not be loaded. Please check your internet connection.');
  }

  const isOneRupee = orderData.priceInRupees === 1 || orderData.amount === 100;

  const options = {
    key: orderData.keyId,
    amount: orderData.amount, // in smallest currency unit (paise)
    currency: orderData.currency || 'INR',
    name: 'FairShare',
    description: isOneRupee
      ? 'Room Creation & Flat Share Plan — First Month Offer (₹1)'
      : 'Room Plan Monthly Subscription Renewal (₹50)',
    image: '/screenshot-wide.png',
    order_id: orderData.orderId,
    handler: function (response) {
      // response: { razorpay_payment_id, razorpay_order_id, razorpay_signature }
      if (onSuccess) onSuccess(response);
    },
    prefill: {
      name: user?.name || '',
      email: user?.email || '',
      contact: user?.mobile || '',
    },
    notes: {
      plan: orderData.plan || (isOneRupee ? 'starter_1rs' : 'standard_50rs'),
      userId: user?.id || user?._id || '',
    },
    theme: {
      color: '#0f6e56',
    },
    modal: {
      ondismiss: function () {
        if (onDismiss) onDismiss();
      },
    },
  };

  const rzpInstance = new window.Razorpay(options);
  rzpInstance.on('payment.failed', function (response) {
    if (onError) onError(response.error);
  });
  rzpInstance.open();
}
