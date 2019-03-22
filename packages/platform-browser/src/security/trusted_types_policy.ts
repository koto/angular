/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

/// <reference types="trusted-types" />

import {Inject, Injectable, InjectionToken, SecurityContext} from '@angular/core';

/**
 * The name of the Trusted Type policy to create.
 * @publicApi
 */
export const TRUSTED_TYPE_POLICY_NAME = new InjectionToken<string>('trusted-type-policy-name');

/**
 * This list is used to wrap values passed from DomRenderer2 in types.
 * Using SecurityContexts just for convenience, as the type contacts match.
 */
const ATTR_TYPE_MAP: {[key: string]: SecurityContext} = {
  // Do not sort.
  'script:src': SecurityContext.RESOURCE_URL,
  // Figure out what to do with script.text, shadowroot innerHTML
  'embed:src': SecurityContext.RESOURCE_URL,
  'iframe:srcdoc': SecurityContext.HTML,
  'object:data': SecurityContext.RESOURCE_URL,
  'object:codebase': SecurityContext.RESOURCE_URL,
  'a:href': SecurityContext.URL,
  '*:src': SecurityContext.URL,
  '*:formaction': SecurityContext.URL,
  '*:innerhtml': SecurityContext.HTML,
  '*:outerhtml': SecurityContext.HTML,
};

/**
 * Adapter for the Trusted Type Policy. 
 * Used by the DomRenderer2 and the sanitizer only. 
 * @see https://wicg.github.io/trusted-types/
 * 
 * @publicApi
 */
export abstract class TrustedTypePolicyAdapter {
  supportsTrustedTypes(): boolean { return false; }
  abstract maybeCreateTrustedURL(value: string): string;
  abstract maybeCreateTrustedHTML(value: string): string;
  abstract maybeCreateTrustedScript(value: string): string;
  abstract maybeCreateTrustedScriptURL(value: string): string;
  abstract maybeCreateTrustedValueForAttribute(
      el: any, name: string, value: string, namespace?: string): string;
  abstract isHTML(obj: any): boolean;
  abstract isURL(obj: any): boolean;
  abstract isScriptURL(obj: any): boolean;
  abstract isScript(obj: any): boolean;
}

@Injectable()
export class TrustedTypePolicyAdapterImpl extends TrustedTypePolicyAdapter {
  private _policy: TrustedTypePolicy|undefined;
  constructor(@Inject(TRUSTED_TYPE_POLICY_NAME) private _name: string) {
    super();
    if (typeof TrustedTypes !== 'undefined' && Boolean(TrustedTypes.createPolicy)) {
      this._policy = TrustedTypes.createPolicy(
          this._name, {
            createURL: (s: string) => s,
            createScriptURL: (s: string) => s,
            createScript: (s: string) => s,
            createHTML: (s: string) => s
          },
          false);
    }
  }

  supportsTrustedTypes(): boolean { return Boolean(this._policy); }

  isHTML(obj: any): boolean {
    return this._policy ? obj instanceof TrustedHTML && (TrustedTypes as any).isHTML(obj) : false;
  }

  isScript(obj: any): boolean {
    return this._policy ? obj instanceof TrustedScript && (TrustedTypes as any).isScript(obj) :
                          false;
  }

  isURL(obj: any): boolean {
    return this._policy ? obj instanceof TrustedURL && (TrustedTypes as any).isURL(obj) : false;
  }

  isScriptURL(obj: any): boolean {
    return this._policy ?
        obj instanceof TrustedScriptURL && (TrustedTypes as any).isScriptURL(obj) :
        false;
  }

  maybeCreateTrustedHTML(s: string): string {
    return this._policy ? this._policy.createHTML(s) as unknown as string : s;
  }
  maybeCreateTrustedURL(s: string): string {
    return this._policy ? this._policy.createURL(s) as unknown as string : s;
  }
  maybeCreateTrustedScriptURL(s: string): string {
    return this._policy ? this._policy.createScriptURL(s) as unknown as string : s;
  }
  maybeCreateTrustedScript(s: string): string {
    return this._policy ? this._policy.createScript(s) as unknown as string : s;
  }
  maybeCreateTrustedValueForAttribute(el: Element, name: string, value: string, namespace?: string):
      string {
    if (!this._policy || !(el instanceof Element)) {
      return value;
    }
    const context = this._getContext(el.tagName.toLowerCase(), name.toLowerCase(), namespace);
    let newValue;
    switch (context) {
      case SecurityContext.HTML:
        newValue = this.maybeCreateTrustedHTML(value);
        break;
      case SecurityContext.URL:
        newValue = this.maybeCreateTrustedURL(value);
        break;
      case SecurityContext.RESOURCE_URL:
        newValue = this.maybeCreateTrustedScriptURL(value);
        break;
      case SecurityContext.SCRIPT:
        newValue = this.maybeCreateTrustedScript(value);
        break;
      case SecurityContext.NONE:
      default:
        newValue = value;
        break;
    }
    return newValue as string;
  }

  private _getContext(tag: string, attribute: string, namespace?: string): SecurityContext {
    const lookupCandidates = [
      tag + ':' + attribute,
      '*:' + attribute,
    ];
    for (let lookup of lookupCandidates)
      if (lookup in ATTR_TYPE_MAP) {
        return ATTR_TYPE_MAP[lookup];
      }
    return SecurityContext.NONE;
  }
}
