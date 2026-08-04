/* eslint-disable */
import type { FunctionComponent } from 'react'
import type { FlexProperties } from '../patterns/flex';
import type { HTMLBambooProps } from '../types/jsx';
import type { DistributiveOmit } from '../types/system-types';

export interface FlexProps extends FlexProperties, DistributiveOmit<HTMLBambooProps<'div'>, keyof FlexProperties > {}


export declare const Flex: FunctionComponent<FlexProps>