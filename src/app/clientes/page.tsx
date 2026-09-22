import { CadastroList } from "@/components/cadastro-list";
export default function Clientes(){return <CadastroList entity="clientes" title="Clientes" description="Gerencie seus clientes." fields={[{key:"name",label:"Nome"},{key:"document",label:"Documento"},{key:"email",label:"E-mail",type:"email"},{key:"phone",label:"Telefone"},{key:"address",label:"Endereço"}]}/>;}
