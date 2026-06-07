import React, { useEffect, useRef, useState } from 'react';

const baseRequest = {
  apiVersion: 2,
  apiVersionMinor: 0,
};

const allowedCardNetworks = ['MASTERCARD', 'VISA'];
const allowedCardAuthMethods = ['PAN_ONLY', 'CRYPTOGRAM_3DS'];

function getTokenizationSpecification(config) {
  return {
    type: 'PAYMENT_GATEWAY',
    parameters: {
      gateway: config.gateway,
      gatewayMerchantId: config.gatewayMerchantId,
    },
  };
}

function getBaseCardPaymentMethod() {
  return {
    type: 'CARD',
    parameters: {
      allowedAuthMethods: allowedCardAuthMethods,
      allowedCardNetworks,
    },
  };
}

function getCardPaymentMethod(config) {
  return {
    ...getBaseCardPaymentMethod(),
    tokenizationSpecification: getTokenizationSpecification(config),
  };
}

export default function GooglePayButton({
  amount,
  currency = 'UAH',
  disabled = false,
  config,
  onPaymentData,
  onError,
}) {
  const buttonRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!window.google?.payments?.api) return;

      const paymentsClient = new window.google.payments.api.PaymentsClient({
        environment: config.environment,
      });

      const isReadyToPayRequest = {
        ...baseRequest,
        allowedPaymentMethods: [getBaseCardPaymentMethod()],
      };

      try {
        const response = await paymentsClient.isReadyToPay(isReadyToPayRequest);

        if (!response.result || cancelled) return;

        setReady(true);

        const button = paymentsClient.createButton({
          onClick: async () => {
            if (disabled) return;

            try {
              const paymentDataRequest = {
                ...baseRequest,
                allowedPaymentMethods: [getCardPaymentMethod(config)],
                merchantInfo: {
                  merchantName: config.merchantName,
                  ...(config.merchantId
                    ? { merchantId: config.merchantId }
                    : {}),
                },
                transactionInfo: {
                  totalPriceStatus: 'FINAL',
                  totalPrice: Number(amount || 0).toFixed(2),
                  currencyCode: currency,
                  countryCode: 'UA',
                },
              };

              const paymentData = await paymentsClient.loadPaymentData(
                paymentDataRequest,
              );

              await onPaymentData(paymentData);
            } catch (error) {
              onError?.(error);
            }
          },
        });

        buttonRef.current.innerHTML = '';
        buttonRef.current.appendChild(button);
      } catch (error) {
        onError?.(error);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [amount, currency, disabled, config, onPaymentData, onError]);

  return (
    <div>
      <div ref={buttonRef} />

      {!ready && (
        <button type="submit" disabled={disabled}>
          {disabled ? 'Оформлюємо…' : 'Підтвердити замовлення'}
        </button>
      )}
    </div>
  );
}