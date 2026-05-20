/* eslint-disable */
import type { FunctionComponent } from 'react'
import type { GridItemProperties } from '../patterns/grid-item';
import type { HTMLBambooProps } from '../types/jsx';
import type { DistributiveOmit } from '../types/system-types';

export interface GridItemProps extends GridItemProperties, DistributiveOmit<HTMLBambooProps<'div'>, keyof GridItemProperties > {}


export declare const GridItem: FunctionComponent<GridItemProps>