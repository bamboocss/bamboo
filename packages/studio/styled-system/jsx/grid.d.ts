/* eslint-disable */
import type { FunctionComponent } from 'react'
import type { GridProperties } from '../patterns/grid';
import type { HTMLBambooProps } from '../types/jsx';
import type { DistributiveOmit } from '../types/system-types';

export interface GridProps extends GridProperties, DistributiveOmit<HTMLBambooProps<'div'>, keyof GridProperties > {}


export declare const Grid: FunctionComponent<GridProps>