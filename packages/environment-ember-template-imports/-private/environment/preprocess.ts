import { GlintExtensionPreprocess } from '@glint/core/config-types';
import { GLOBAL_TAG, PreprocessData, TemplateLocation } from './common';
/**
 * We don't need to actually generate the code that would be emitted for
 * a real app to build, we can use placeholders, so we have less offsets
 * to worry about (precompile, setComponentTemplate, their imports, etc)
 */
const TEMPLATE_START = `[${GLOBAL_TAG}\``;
const TEMPLATE_END = '`]';

// content-tag 1.2.2:
//   The current file is a CommonJS module whose imports will produce 'require' calls; 
//   however, the referenced file is an ECMAScript module and cannot be imported with 'require'. 
//   Consider writing a dynamic 'import("content-tag")' call instead.
//   To convert this file to an ECMAScript module, change its file extension to '.mts', 
//   or add the field `"type": "module"` to 'glint/packages/environment-ember-template-imports/package.json'.ts(1479)
//
// ...Except, 
//    > the referenced file is an ECMAScript module 
//
//    package.json#exports does refer to a cjs file if required, so TS should be resolving the `require`
//    entries not the `import` entries.
//
//    https://github.com/embroider-build/content-tag/blob/v1.2.2-content-tag/package.json#L13-L21
//
// @ts-expect-error
import { Preprocessor } from 'content-tag';
const p = new Preprocessor();

export const preprocess: GlintExtensionPreprocess<PreprocessData> = (source, path) => {
  let templates = p.parse(source, path);

  let templateLocations: Array<TemplateLocation> = [];
  let segments: Array<string> = [];
  let sourceOffset = 0;
  let delta = 0;

  for (let template of templates) {
    let startTagLength = template.startRange.end - template.startRange.start;
    let endTagLength = template.endRange.end - template.endRange.start;
    let startTagOffset = template.startRange.start;
    let endTagOffset = template.endRange.start;

    if (startTagOffset === -1 || endTagOffset === -1) continue;

    let transformedStart = startTagOffset - delta;

    segments.push(source.slice(sourceOffset, startTagOffset));
    segments.push(TEMPLATE_START);
    delta += startTagLength - TEMPLATE_START.length;

    let transformedEnd = endTagOffset - delta + TEMPLATE_END.length;

    segments.push(source.slice(startTagOffset + startTagLength, endTagOffset));
    segments.push(TEMPLATE_END);
    delta += endTagLength - TEMPLATE_END.length;

    sourceOffset = endTagOffset + endTagLength;

    templateLocations.push({
      startTagOffset,
      endTagOffset,
      startTagLength,
      endTagLength,
      transformedStart,
      transformedEnd,
    });
  }

  segments.push(source.slice(sourceOffset));

  return {
    contents: segments.join(''),
    data: {
      templateLocations,
    },
  };
};
