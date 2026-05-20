/* eslint-disable */
import type { FunctionComponent } from 'react'
import type { BleedProperties } from '../patterns/bleed';
import type { HTMLBambooProps } from '../types/jsx';
import type { DistributiveOmit } from '../types/system-types';

export interface BleedProps extends BleedProperties, DistributiveOmit<HTMLBambooProps<'div'>, keyof BleedProperties > {}


export declare const Bleed: FunctionComponent<BleedProps>