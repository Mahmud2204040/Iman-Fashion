import { useState } from 'react';
import { shopDate } from '../../utils/customer.js';

export function useCustomerDraft({ initialChild = false } = {}) {
  const [draft, setDraft] = useState({
    name: '', phone: '', address: '', notes: '', children: initialChild ? [{
      name: '', initialClass: '', schoolName: '', registeredDate: shopDate(),
    }] : [],
  });

  function setField(field, value) {
    setDraft((previous) => ({ ...previous, [field]: value }));
  }

  function addChild() {
    setDraft((previous) => ({
      ...previous,
      children: [...previous.children, {
        name: '', initialClass: '', schoolName: '', registeredDate: shopDate(),
      }],
    }));
  }

  function removeChild(index) {
    setDraft((previous) => ({
      ...previous,
      children: previous.children.filter((_, current) => current !== index),
    }));
  }

  function setChildField(index, field, value) {
    setDraft((previous) => ({
      ...previous,
      children: previous.children.map((child, current) =>
        current === index ? { ...child, [field]: value } : child),
    }));
  }

  return { draft, setField, addChild, removeChild, setChildField };
}
