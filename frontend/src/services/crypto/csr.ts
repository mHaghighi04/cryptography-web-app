/**
 * Certificate Signing Request (CSR) generation using node-forge.
 * Generates CSRs compatible with the OpenSSL CA in AC1/.
 */

import forge from 'node-forge';

/**
 * Generate a Certificate Signing Request (CSR) for a user.
 *
 * @param privateKeyPem - PEM-encoded RSA private key
 * @param publicKeyPem - PEM-encoded RSA public key
 * @param username - Username to use as Common Name (CN)
 * @returns PEM-encoded CSR
 */
export function generateCSR(
  privateKeyPem: string,
  publicKeyPem: string,
  username: string
): string {
  // Parse the keys from PEM format
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);

  // Create CSR
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = publicKey;

  // Set subject attributes matching AC1 CA requirements
  // Country and Organization must match the CA policy
  csr.setSubject([
    { name: 'countryName', value: 'ES' },
    { name: 'stateOrProvinceName', value: 'MADRID' },
    { name: 'organizationName', value: 'UC3M' },
    { name: 'commonName', value: username }
  ]);

  // Sign the CSR with the private key using SHA-256
  csr.sign(privateKey, forge.md.sha256.create());

  // Export as PEM
  return forge.pki.certificationRequestToPem(csr);
}

/**
 * Extract the public key from a certificate in PEM format.
 *
 * @param certPem - PEM-encoded X.509 certificate
 * @returns PEM-encoded public key
 */
export function getPublicKeyFromCertificate(certPem: string): string {
  const cert = forge.pki.certificateFromPem(certPem);
  return forge.pki.publicKeyToPem(cert.publicKey);
}

/**
 * Extract certificate information for display.
 *
 * @param certPem - PEM-encoded X.509 certificate
 * @returns Certificate metadata
 */
export function getCertificateInfo(certPem: string): {
  subject: string;
  issuer: string;
  validFrom: Date;
  validTo: Date;
  serial: string;
} {
  const cert = forge.pki.certificateFromPem(certPem);

  // Get Common Name from subject
  const subjectCN = cert.subject.getField('CN');
  const issuerCN = cert.issuer.getField('CN');

  return {
    subject: subjectCN ? subjectCN.value : 'Unknown',
    issuer: issuerCN ? issuerCN.value : 'Unknown',
    validFrom: cert.validity.notBefore,
    validTo: cert.validity.notAfter,
    serial: cert.serialNumber,
  };
}

/**
 * Verify a certificate was signed by a CA.
 *
 * @param certPem - PEM-encoded certificate to verify
 * @param caCertPem - PEM-encoded CA certificate
 * @returns true if certificate is valid and signed by CA
 */
export function verifyCertificate(certPem: string, caCertPem: string): boolean {
  try {
    const cert = forge.pki.certificateFromPem(certPem);
    const caCert = forge.pki.certificateFromPem(caCertPem);

    // Verify the certificate was signed by the CA
    return caCert.verify(cert);
  } catch {
    return false;
  }
}

/**
 * Check if a certificate has expired.
 *
 * @param certPem - PEM-encoded certificate
 * @returns true if certificate has expired
 */
export function isCertificateExpired(certPem: string): boolean {
  const cert = forge.pki.certificateFromPem(certPem);
  return new Date() > cert.validity.notAfter;
}
