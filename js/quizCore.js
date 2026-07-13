(function (root) {
  'use strict';

  const SECRET_CONTENT = 'lamian';
  const TYPE_BY_CONTENT = Object.freeze({
    person: Object.freeze(['choice', 'fill', 'judge']),
    quote: Object.freeze(['choice', 'fill', 'judge']),
    author: Object.freeze(['choice', 'fill', 'judge']),
    date: Object.freeze(['choice']),
    [SECRET_CONTENT]: Object.freeze(['fill'])
  });

  function cloneFilters(types, contents) {
    return {
      types: new Set(types || []),
      contents: new Set(contents || [])
    };
  }

  function isVisibleContent(content, secretUnlocked) {
    return content !== SECRET_CONTENT || Boolean(secretUnlocked);
  }

  function getCandidateTypes(source, content, types) {
    const variants = source?.variants?.[content] || {};
    const allowedTypes = TYPE_BY_CONTENT[content] || [];
    return allowedTypes.filter((type) => types.has(type) && variants[type]);
  }

  function getCandidateContents(source, { types, contents }, secretUnlocked = false) {
    return Object.keys(source?.variants || {}).filter((content) => (
      contents.has(content)
      && isVisibleContent(content, secretUnlocked)
      && getCandidateTypes(source, content, types).length > 0
    ));
  }

  function getCandidateSources(sources, filters, secretUnlocked = false) {
    return (sources || []).filter((source) => getCandidateContents(source, filters, secretUnlocked).length > 0);
  }

  function hasGeneratableQuestion(sources, filters, secretUnlocked = false) {
    return getCandidateSources(sources, filters, secretUnlocked).length > 0;
  }

  function simulateToggle(sources, filters, group, value, secretUnlocked = false) {
    if (!['types', 'contents'].includes(group)) return { filters: cloneFilters(filters.types, filters.contents), changed: false };
    const next = cloneFilters(filters.types, filters.contents);
    const values = next[group];
    if (!values.has(value)) {
      values.add(value);
      return { filters: next, changed: true };
    }
    values.delete(value);
    if (!hasGeneratableQuestion(sources, next, secretUnlocked)) {
      return { filters: cloneFilters(filters.types, filters.contents), changed: false };
    }
    return { filters: next, changed: true };
  }

  function canDeselect(sources, filters, group, value, secretUnlocked = false) {
    if (!filters?.[group]?.has(value)) return true;
    return simulateToggle(sources, filters, group, value, secretUnlocked).changed;
  }

  function pickUniform(items, random = Math.random) {
    if (!items.length) return null;
    const value = Number(random());
    const normalized = Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.9999999999999999) : 0;
    return items[Math.floor(normalized * items.length)];
  }

  function pickQuestion(sources, filters, { secretUnlocked = false, random = Math.random } = {}) {
    const candidateSources = getCandidateSources(sources, filters, secretUnlocked);
    const source = pickUniform(candidateSources, random);
    if (!source) return null;
    const contents = getCandidateContents(source, filters, secretUnlocked);
    const content = pickUniform(contents, random);
    const types = getCandidateTypes(source, content, filters.types);
    const type = pickUniform(types, random);
    const question = source.variants[content][type];
    return question ? { question, source, content, type } : null;
  }

  root.ClassRecordQuizCore = Object.freeze({
    SECRET_CONTENT,
    TYPE_BY_CONTENT,
    canDeselect,
    cloneFilters,
    getCandidateContents,
    getCandidateSources,
    getCandidateTypes,
    hasGeneratableQuestion,
    pickQuestion,
    simulateToggle
  });
})(typeof window !== 'undefined' ? window : globalThis);
