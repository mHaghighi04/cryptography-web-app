import { CertificateStatus as CertStatus } from '../types';

interface CertificateStatusProps {
  status: CertStatus | undefined;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

/**
 * Display certificate status with appropriate icon and color.
 */
export function CertificateStatus({
  status,
  showLabel = true,
  size = 'md',
}: CertificateStatusProps) {
  const sizeClasses = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  const statusConfig: Record<CertStatus | 'none', { icon: string; color: string; label: string; title: string }> = {
    none: {
      icon: '?',
      color: 'text-gray-400',
      label: 'No Certificate',
      title: 'User has not submitted a certificate signing request',
    },
    pending: {
      icon: '...',
      color: 'text-yellow-500',
      label: 'Pending',
      title: 'Certificate signing request submitted, awaiting CA approval',
    },
    active: {
      icon: '\u2713',
      color: 'text-green-500',
      label: 'Verified',
      title: 'Certificate is active and verified by CA',
    },
    expired: {
      icon: '!',
      color: 'text-red-500',
      label: 'Expired',
      title: 'Certificate has expired',
    },
    revoked: {
      icon: 'X',
      color: 'text-red-600',
      label: 'Revoked',
      title: 'Certificate has been revoked',
    },
  };

  const config = statusConfig[status || 'none'];

  return (
    <div className="flex items-center gap-1" title={config.title}>
      <span
        className={`inline-flex items-center justify-center ${sizeClasses} ${config.color} font-bold rounded-full border-2 border-current`}
        style={{ fontSize: size === 'sm' ? '10px' : '12px' }}
      >
        {config.icon}
      </span>
      {showLabel && (
        <span className={`${textSize} ${config.color}`}>{config.label}</span>
      )}
    </div>
  );
}

/**
 * Badge showing both users' certificate statuses in a conversation.
 */
export function ConversationCertificateBadge({
  myStatus,
  theirStatus,
}: {
  myStatus: CertStatus | undefined;
  theirStatus: CertStatus | undefined;
}) {
  const bothActive = myStatus === 'active' && theirStatus === 'active';

  if (bothActive) {
    return (
      <div
        className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs"
        title="Both users have verified certificates - messages are fully secured"
      >
        <span className="font-bold">\u2713\u2713</span>
        <span>Secure</span>
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs"
      title="One or both users do not have active certificates"
    >
      <span>!</span>
      <span>Limited Security</span>
    </div>
  );
}
