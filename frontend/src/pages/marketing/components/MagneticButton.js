import React, { useRef } from 'react';

/**
 * MagneticButton — wraps children with a subtle pointer-following translation.
 * Adds a click ripple effect for tactile feedback.
 * Renders as an anchor by default, but any element via `as` prop.
 */
const MagneticButton = ({
  as: Component = 'a',
  strength = 0.28,
  children,
  className = '',
  onClick,
  ...rest
}) => {
  const ref = useRef(null);

  const handleMouseMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width / 2)) * strength;
    const dy = (e.clientY - (rect.top + rect.height / 2)) * strength;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const handleMouseLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = '';
  };
  const handleClick = (e) => {
    const el = ref.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'mkt-ripple';
      const size = Math.max(rect.width, rect.height) * 1.4;
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      el.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
    }
    if (onClick) onClick(e);
  };

  return (
    <Component
      ref={ref}
      className={`mkt-magnetic ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      {...rest}
    >
      <span className="mkt-magnetic-inner">{children}</span>
    </Component>
  );
};

export default MagneticButton;
