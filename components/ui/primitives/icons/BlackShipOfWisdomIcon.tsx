/**
 * Black Ship of Wisdom Icon
 * Special treatment icon
 */

interface BlackShipOfWisdomIconProps {
  className?: string;
  color?: string;
}

export function BlackShipOfWisdomIcon({ className = "", color = "black" }: BlackShipOfWisdomIconProps) {
  return (
    <div className={`relative size-[24px] ${className}`}>
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 60 60">
        <path 
          d="M29.7168 1.76074C45.1562 1.76084 57.6719 14.2774 57.6719 29.7168C57.6718 45.1561 45.1561 57.6718 29.7168 57.6719C14.2774 57.6719 1.76084 45.1562 1.76074 29.7168C1.76074 14.2773 14.2773 1.76074 29.7168 1.76074Z" 
          stroke={color} 
          strokeWidth="3.52197" 
          strokeMiterlimit="10"
        />
        <path 
          d="M29.717 8.3645C41.5092 8.3647 51.0686 17.9248 51.0686 29.717C51.0684 41.5091 41.5091 51.0684 29.717 51.0686C17.9248 51.0686 8.3647 41.5092 8.3645 29.717C8.3645 17.9247 17.9247 8.3645 29.717 8.3645Z" 
          stroke={color} 
          strokeWidth="3.52197" 
          strokeMiterlimit="10"
        />
        <path 
          d="M20.4719 23.553C23.8757 23.5532 26.635 26.3132 26.635 29.717C26.6348 33.1207 23.8756 35.8799 20.4719 35.8801C17.0681 35.8801 14.3081 33.1208 14.3079 29.717C14.3079 26.3131 17.0679 23.553 20.4719 23.553Z" 
          stroke={color} 
          strokeWidth="3.52197" 
          strokeMiterlimit="10"
        />
        <path 
          d="M38.9622 23.553C42.366 23.5532 45.1252 26.3132 45.1252 29.717C45.125 33.1207 42.3658 35.8799 38.9622 35.8801C35.5583 35.8801 32.7983 33.1208 32.7981 29.717C32.7981 26.3131 35.5582 23.553 38.9622 23.553Z" 
          stroke={color} 
          strokeWidth="3.52197" 
          strokeMiterlimit="10"
        />
      </svg>
    </div>
  );
}
