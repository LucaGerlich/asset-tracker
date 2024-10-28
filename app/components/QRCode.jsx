import React, { forwardRef, useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";

const QRCodeWithRef = forwardRef((props, ref) => {
  useEffect(() => {
    if (ref.current) {
      ref.current = ref.current.querySelector("canvas");
    }
  }, [ref]);

  return (
    <div ref={ref}>
      <QRCodeCanvas {...props} />
    </div>
  );
});

QRCodeWithRef.displayName = "QRCodeWithRef"; // Add display name

export default QRCodeWithRef;
